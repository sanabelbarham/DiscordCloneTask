import { test, expect, type Browser, type Page } from "@playwright/test";

/** Verifies actual media flow between two participants — not just that both
 * reach a connected roster (join-call.spec.ts), but that each side's remote
 * <video> element is receiving live audio+video tracks, and that toggling the
 * camera off does not also silence the outgoing audio track. */

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Display name").fill(email.split("@")[0]);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Select or create a server")).toBeVisible({ timeout: 10_000 });
}

/** Reads the live/ended state of every track on the *remote* video tile's
 * MediaStream (the tile whose displayName isn't `excludeName`). */
async function remoteTrackStates(page: Page, excludeName: string) {
  return page.evaluate((exclude) => {
    const videos = Array.from(document.querySelectorAll('[data-testid="video-tile"]'));
    const remoteTile = videos.find((tile) => !tile.textContent?.includes(exclude));
    const video = remoteTile?.querySelector("video") as HTMLVideoElement | null;
    const stream = video?.srcObject as MediaStream | null | undefined;
    if (!stream) return null;
    return {
      audio: stream.getAudioTracks().map((t) => ({ readyState: t.readyState, enabled: t.enabled })),
      video: stream.getVideoTracks().map((t) => ({ readyState: t.readyState, enabled: t.enabled })),
      videoElementHidden: video?.classList.contains("hidden") ?? true,
    };
  }, excludeName);
}

test("two participants exchange live audio+video, and toggling camera off does not silence audio", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const stamp = Date.now();
  const contextA = await browser.newContext({ permissions: ["camera", "microphone"] });
  const contextB = await browser.newContext({ permissions: ["camera", "microphone"] });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const nameA = `media-a-${stamp}`;
  const nameB = `media-b-${stamp}`;
  await signUp(pageA, `${nameA}@example.com`, "password123!");
  await signUp(pageB, `${nameB}@example.com`, "password123!");

  await pageA.getByTitle("Create a server").click();
  await pageA.getByPlaceholder("Server name").fill(`Media Test ${stamp}`);
  await pageA.getByRole("button", { name: "Create" }).click();
  await pageA.waitForURL(/\/servers\//);

  const inviteUrl = await pageA.locator("input[readonly]").inputValue();
  await pageB.goto(new URL(inviteUrl).pathname);
  await pageB.waitForURL(/\/servers\//);

  await pageA.getByTitle("Add voice channel").click();
  const nameInput = pageA.locator('input[placeholder="new-channel-name"]');
  await nameInput.fill("media-voice");
  await nameInput.press("Enter");

  await pageA.getByText("media-voice").click();
  await pageA.waitForURL(/\/voice\//);
  await pageB.goto(pageA.url());

  await expect(pageA.locator('[data-testid="video-tile"]')).toHaveCount(2, { timeout: 15_000 });
  await expect(pageB.locator('[data-testid="video-tile"]')).toHaveCount(2, { timeout: 15_000 });

  // Give WebRTC negotiation a moment to finish landing tracks on both sides.
  await expect
    .poll(async () => (await remoteTrackStates(pageA, nameA))?.audio[0]?.readyState, { timeout: 15_000 })
    .toBe("live");
  await expect
    .poll(async () => (await remoteTrackStates(pageB, nameB))?.audio[0]?.readyState, { timeout: 15_000 })
    .toBe("live");

  const beforeOnA = await remoteTrackStates(pageA, nameA);
  const beforeOnB = await remoteTrackStates(pageB, nameB);
  expect(beforeOnA?.video[0]?.readyState).toBe("live");
  expect(beforeOnB?.video[0]?.readyState).toBe("live");

  // B turns their camera off — A should keep receiving B's audio uninterrupted.
  await pageB.getByRole("button", { name: "Stop Video" }).click();

  await expect
    .poll(async () => (await remoteTrackStates(pageA, nameA))?.videoElementHidden, { timeout: 10_000 })
    .toBe(true);
  const afterOnA = await remoteTrackStates(pageA, nameA);
  expect(afterOnA?.audio[0]?.readyState).toBe("live");
});
