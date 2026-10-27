import { test, expect } from "@playwright/test";
test("write, persist, search, toggle task, pin, delete and restore", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "첫 생각 기록하기" }).click();
  await page
    .getByRole("textbox", { name: "메모 본문" })
    .fill("# 나의 첫 기록\n\n오늘 산책\n\n- [ ] 물 마시기\n- [x] 스트레칭");
  await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  await page.reload();
  await page.getByRole("button").filter({ hasText: "나의 첫 기록" }).click();
  await expect(page.getByRole("textbox", { name: "메모 본문" })).toHaveValue(
    /오늘 산책/,
  );
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await page.getByRole("checkbox").first().check();
  await expect(page.getByText("할 일 2/2 완료")).toBeVisible();
  await page.getByRole("button", { name: "편집", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "메모 본문" })).toHaveValue(
    /\[x\] 물 마시기/,
  );
  await page.getByRole("button", { name: "메모 고정", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "고정 해제", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "메모 검색" }).fill("없는 단어");
  await expect(page.getByText("찾는 메모가 없어요")).toBeVisible();
  await page.getByRole("textbox", { name: "메모 검색" }).fill("");
  await page.getByRole("button", { name: "메모 삭제", exact: true }).click();
  await page.getByRole("button", { name: "휴지통", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "나의 첫 기록" }).click();
  await page.getByRole("button", { name: "메모 복원" }).click();
  await page.getByRole("button", { name: /모든 메모/ }).click();
  await expect(
    page.getByRole("button").filter({ hasText: "나의 첫 기록" }),
  ).toBeVisible();
});
test("mobile editing and sanitized markdown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "새 메모", exact: true }).click();
  await page
    .getByRole("textbox", { name: "메모 본문" })
    .fill(
      "# 모바일\n\n<script>window.hacked=true</script>\n\n[위험](javascript:alert(1))",
    );
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "모바일" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => (window as any).hacked)).toBeUndefined();
  await expect(page.locator(".markdown a")).not.toHaveAttribute(
    "href",
    /javascript/,
  );
  await page.getByRole("button", { name: "목록으로" }).click();
  await expect(page.getByRole("textbox", { name: "메모 검색" })).toBeVisible();
});
test("production app reloads offline with persisted notes", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("button", { name: "첫 생각 기록하기" }).click();
  await page
    .getByRole("textbox", { name: "메모 본문" })
    .fill("# 오프라인 기록");
  await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button").filter({ hasText: "오프라인 기록" }).click();
  await expect(page.getByRole("textbox", { name: "메모 본문" })).toHaveValue(
    "# 오프라인 기록",
  );
  await page
    .getByRole("textbox", { name: "메모 본문" })
    .fill("# 오프라인에서도 수정");
  await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  await context.setOffline(false);
});
