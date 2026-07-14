import { test, expect, type Browser, type Page } from "@playwright/test";

/** Constitution-mandated smoke test (Testable Seams): a message sent by one
 * member must appear for another member in real time, no refresh (FR-015). */

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Display name").fill(email.split("@")[0]);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Select or create a server")).toBeVisible({ timeout: 10_000 });
}

async function newSession(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test("a message sent by one member appears for another member in real time", async ({ browser }) => {
  const stamp = Date.now();
  const pageA = await newSession(browser);
  const pageB = await newSession(browser);

  await signUp(pageA, `smoke-a-${stamp}@example.com`, "password123!");
  await signUp(pageB, `smoke-b-${stamp}@example.com`, "password123!");

  await pageA.getByTitle("Create a server").click();
  await pageA.getByPlaceholder("Server name").fill(`Smoke Test ${stamp}`);
  await pageA.getByRole("button", { name: "Create" }).click();
  await pageA.waitForURL(/\/servers\//);

  const inviteInput = pageA.locator("input[readonly]");
  const inviteUrl = await inviteInput.inputValue();

  await pageB.goto(new URL(inviteUrl).pathname);
  await pageB.waitForURL(/\/servers\//);

  await pageA.getByText("general").first().click();
  await pageA.waitForURL(/\/channels\//);
  await pageB.goto(pageA.url());

  const messageText = `hello from A ${stamp}`;
  await pageA.getByPlaceholder(/Message #general/).fill(messageText);
  await pageA.getByPlaceholder(/Message #general/).press("Enter");

  await expect(pageB.getByText(messageText)).toBeVisible({ timeout: 10_000 });
});
