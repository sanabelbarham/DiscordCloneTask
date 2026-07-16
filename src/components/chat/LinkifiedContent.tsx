import { Link } from "react-router-dom";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Splits message text on URLs and renders each as a clickable link. Invite
 * links that point at this app's own origin navigate in-app (so the
 * auto-join in JoinInvitePage fires immediately) instead of a full reload. */
export default function LinkifiedContent({ content }: { content: string }) {
  // A single capturing group means split() interleaves the array as
  // [text, url, text, url, ...] — odd indices are always the matched URLs.
  const parts = content.split(URL_PATTERN);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;

        let url: URL;
        try {
          url = new URL(part);
        } catch {
          return part;
        }

        const inviteMatch = url.origin === window.location.origin && url.pathname.match(/^\/invite\/(.+)$/);
        if (inviteMatch) {
          return (
            <Link key={i} to={`/invite/${inviteMatch[1]}`} className="text-text-link hover:underline">
              {part}
            </Link>
          );
        }

        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-text-link hover:underline">
            {part}
          </a>
        );
      })}
    </>
  );
}
