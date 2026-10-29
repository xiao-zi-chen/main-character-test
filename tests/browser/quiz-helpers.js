import { expect } from '@playwright/test';

export async function finishReactionPreview(page) {
  const preview = page.getByRole('dialog', { name: '所选反应预览' });
  await expect(preview).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(preview).toHaveCount(0);
}

export async function navigateQuestion(page, direction = 'next') {
  const button = page.getByRole('button', {
    name: direction === 'previous' ? /^上一题$/ : /^(下一题|揭晓我的主角)$/,
  });
  await expect(button).toBeVisible();
  // Some callers intentionally try advancing an unselected or blocked session.
  // Native disabled buttons must remain inert.
  if (await button.isDisabled()) return;
  await button.click();
}

export async function confirmAnswer(page, { final = false } = {}) {
  const counter = await page.locator('.quiz-counter').innerText();
  await navigateQuestion(page, 'next');
  await expect(page.getByRole('dialog', { name: '所选反应预览' })).toHaveCount(0);
  if (final) await expect(page.locator('.quiz-counter')).toHaveCount(0);
  else await expect(page.locator('.quiz-counter')).not.toHaveText(counter);
}
