import { expect } from '@playwright/test';

export async function finishReactionPreview(page) {
  const preview = page.getByRole('region', { name: '所选反应预览' });
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: '关闭选择预览', exact: true }).click();
  await expect(preview).toHaveCount(0);
}

export async function confirmAnswer(page, { final = false } = {}) {
  const counter = await page.locator('.quiz-counter').innerText();
  await page.getByRole('button', { name: final ? '揭晓我的主角' : '下一幕', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText(counter);
  if (final) await expect(page).toHaveURL(/#\/test$/);
  await finishReactionPreview(page);
  if (final) await expect(page.locator('.quiz-counter')).toHaveCount(0);
  else await expect(page.locator('.quiz-counter')).not.toHaveText(counter);
}
