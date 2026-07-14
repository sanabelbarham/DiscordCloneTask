import { test, expect, type Browser, type Page } from "@playwright/test";

/** Constitution-mandated smoke test (Testable Seams): two browser contexts
 * join the same voice channel and both reach a connected call state (FR-024). */

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Display name").fill(email.split("@")[0]);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Select or create a server")).toBeVisible({ timeout: 10_000 });
}

test("two participants joining the same voice channel both reach a connected call", async ({ browser }: { browser: Browser }) => {
  const stamp = Date.now();
  const contextA = await browser.newContext({ permissions: ["camera", "microphone"] });
  const contextB = await browser.newContext({ permissions: ["camera", "microphone"] });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signUp(pageA, `call-a-${stamp}@example.com`, "password123!");
  await signUp(pageB, `call-b-${stamp}@example.com`, "password123!");

  await pageA.getByTitle("Create a server").click();
  await pageA.getByPlaceholder("Server name").fill(`Call Test ${stamp}`);
  await pageA.getByRole("button", { name: "Create" }).click();
  await pageA.waitForURL(/\/servers\//);

  const inviteUrl = await pageA.locator("input[readonly]").inputValue();
  await pageB.goto(new URL(inviteUrl).pathname);
  await pageB.waitForURL(/\/servers\//);

  await pageA.getByTitle("Add voice channel").click();
  const nameInput = pageA.locator('input[placeholder="new-channel-name"]');
  await nameInput.fill("general-voice");
  await nameInput.press("Enter");

  await pageA.getByText("general-voice").click();
  await pageA.waitForURL(/\/voice\//);
  await pageB.goto(pageA.url());

  // Each page's own call grid should end up showing both participants' tiles,
  // confirming both reached the same connected call (research.md §3).
  await expect(pageA.locator('[data-testid="video-tile"]')).toHaveCount(2, { timeout: 15_000 });
  await expect(pageB.locator('[data-testid="video-tile"]')).toHaveCount(2, { timeout: 15_000 });
});
