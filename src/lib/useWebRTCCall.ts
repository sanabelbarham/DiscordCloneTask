import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

interface PeerEntry {
  connection: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
}

/**
 * Mesh WebRTC connection management for a call (research.md §3): diffs the
 * reactive participant roster against locally-held RTCPeerConnections to
 * discover/tear-down peers, applies the deterministic lower-Id<"users">-offers
 * rule so there is never an offer race, and exchanges offer/answer/ICE via the
 * `signals` table, buffering ICE candidates that arrive before the remote
 * description is set.
 */
export function useWebRTCCall(callId: Id<"calls"> | null) {
  const profile = useQuery(api.users.getCurrentProfile);
  const participants = useQuery(api.calls.listParticipants, callId ? { callId } : "skip");
  const mySignals = useQuery(api.signals.listForMe, callId ? { callId } : "skip");
  const sendSignal = useMutation(api.signals.send);
  const consumeSignal = useMutation(api.signals.consume);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<Id<"users">, MediaStream>>(new Map());
  const peersRef = useRef<Map<Id<"users">, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const processedSignalIds = useRef<Set<string>>(new Set());

  // Acquire local mic/camera once for the lifetime of the call.
  useEffect(() => {
    if (!callId) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      })
      .catch(() => {
        // No camera/mic available — proceed audio/video-less rather than blocking the call.
      });

    // peersRef/processedSignalIds are plain mutable instance state (not DOM
    // node refs), so reading `.current` at cleanup time is intentional — it
    // must reflect whatever peers/signals exist *at unmount*, not at mount.
    /* eslint-disable react-hooks/exhaustive-deps */
    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      peersRef.current.forEach((peer) => peer.connection.close());
      peersRef.current.clear();
      setRemoteStreams(new Map());
      processedSignalIds.current.clear();
    };
    /* eslint-enable react-hooks/exhaustive-deps */
  }, [callId]);

  function closePeer(userId: Id<"users">) {
    const peer = peersRef.current.get(userId);
    if (!peer) return;
    peer.connection.close();
    peersRef.current.delete(userId);
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }

  function ensurePeer(peerId: Id<"users">): PeerEntry {
    let peer = peersRef.current.get(peerId);
    if (peer) return peer;

    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer = { connection, pendingCandidates: [] };
    peersRef.current.set(peerId, peer);

    localStreamRef.current?.getTracks().forEach((track) => {
      connection.addTrack(track, localStreamRef.current!);
    });

    connection.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(peerId, event.streams[0]);
        return next;
      });
    };

    connection.onicecandidate = (event) => {
      if (event.candidate && callId) {
        void sendSignal({
          callId,
          toUserId: peerId,
          type: "ice-candidate",
          payload: JSON.stringify(event.candidate.toJSON()),
        });
      }
    };

    return peer;
  }

  // Roster diff: connect to newly-appeared peers (deterministic offerer rule),
  // tear down connections to peers who left, were removed, or went stale.
  useEffect(() => {
    if (!callId || !profile || !participants || !localStream) return;
    const myId = profile._id;
    const rosterIds = new Set(participants.filter((p) => p.userId !== myId).map((p) => p.userId));

    for (const peerId of rosterIds) {
      if (peersRef.current.has(peerId)) continue;
      const peer = ensurePeer(peerId);
      const iAmOfferer = myId < peerId;
      if (iAmOfferer) {
        void (async () => {
          const offer = await peer.connection.createOffer();
          await peer.connection.setLocalDescription(offer);
          await sendSignal({
            callId,
            toUserId: peerId,
            type: "offer",
            payload: JSON.stringify(offer),
          });
        })();
      }
    }

    for (const peerId of Array.from(peersRef.current.keys())) {
      if (!rosterIds.has(peerId)) closePeer(peerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, profile, participants, localStream]);

  // Process inbound signaling messages as they arrive.
  useEffect(() => {
    if (!callId || !mySignals) return;
    const ordered = [...mySignals].sort((a, b) => a.createdAt - b.createdAt);

    void (async () => {
      for (const signal of ordered) {
        if (processedSignalIds.current.has(signal._id)) continue;
        processedSignalIds.current.add(signal._id);

        const peer = ensurePeer(signal.fromUserId);
        if (signal.type === "offer") {
          const offer = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
          await peer.connection.setRemoteDescription(offer);
          for (const candidate of peer.pendingCandidates.splice(0)) {
            await peer.connection.addIceCandidate(candidate);
          }
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          await sendSignal({
            callId,
            toUserId: signal.fromUserId,
            type: "answer",
            payload: JSON.stringify(answer),
          });
        } else if (signal.type === "answer") {
          const answer = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
          await peer.connection.setRemoteDescription(answer);
          for (const candidate of peer.pendingCandidates.splice(0)) {
            await peer.connection.addIceCandidate(candidate);
          }
        } else {
          const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
          if (peer.connection.remoteDescription) {
            await peer.connection.addIceCandidate(candidate);
          } else {
            peer.pendingCandidates.push(candidate);
          }
        }

        await consumeSignal({ signalId: signal._id });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, mySignals]);

  function toggleMic(nextOn: boolean) {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = nextOn));
  }

  function toggleCamera(nextOn: boolean) {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = nextOn));
  }

  return { localStream, remoteStreams, toggleMic, toggleCamera };
}
