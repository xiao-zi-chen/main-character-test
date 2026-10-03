import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('mobile slogans and final call to action remain fully visible', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('.work/mobile-layout', { recursive: true });
  for (const reducedMotion of ['reduce', 'no-preference']) {
    await page.emulateMedia({ reducedMotion });
    for (const width of [320, 375, 393, 430, 680, 852]) {
      await page.setViewportSize({ width, height: width === 852 ? 393 : 659 });
      await page.goto('/');
      await expect(page.locator('.story-ribbon span')).toHaveCount(4);
      const layout = await page.evaluate(() => {
        const rect = element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
        };
        const ribbon = document.querySelector('.story-ribbon');
        const cta = document.querySelector('.bottom-cta');
        const note = document.querySelector('.cta-footnote');
        const star = document.querySelector('.cta-star');
        const textBounds = [...ribbon.querySelectorAll('span')].flatMap(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return [...range.getClientRects()].map(box => ({ left: box.left, right: box.right }));
        });
        const ring = getComputedStyle(cta, '::after');
        return {
          screenWidth: innerWidth, documentWidth: document.documentElement.scrollWidth,
          ribbon: rect(ribbon), ribbonText: textBounds,
          cta: rect(cta), star: rect(star), note: rect(note), button: rect(cta.querySelector('button')),
          noteFont: parseFloat(getComputedStyle(note).fontSize),
          ring: { width: parseFloat(ring.width), height: parseFloat(ring.height),
            right: parseFloat(ring.right), bottom: parseFloat(ring.bottom) },
        };
      });
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.screenWidth);
      for (const bounds of layout.ribbonText) {
        expect(bounds.left).toBeGreaterThanOrEqual(layout.ribbon.left - 1);
        expect(bounds.right).toBeLessThanOrEqual(layout.ribbon.right + 1);
      }
      if (width <= 680) {
        for (const bounds of [layout.star, layout.note, layout.button]) {
          expect(bounds.left).toBeGreaterThanOrEqual(layout.cta.left);
          expect(bounds.right).toBeLessThanOrEqual(layout.cta.right);
          expect(bounds.top).toBeGreaterThanOrEqual(layout.cta.top);
          expect(bounds.bottom).toBeLessThanOrEqual(layout.cta.bottom);
        }
        expect(layout.noteFont).toBeGreaterThanOrEqual(11);
        expect(layout.note.top).toBeGreaterThan(layout.button.bottom);
        expect(layout.note.right).toBeLessThan(layout.star.left);
        expect(layout.ring.right).toBeGreaterThanOrEqual(0);
        expect(layout.ring.bottom).toBeGreaterThanOrEqual(0);
        expect(layout.ring.width + layout.ring.right).toBeLessThan(layout.cta.right - layout.cta.left);
        expect(layout.ring.height + layout.ring.bottom).toBeLessThan(layout.cta.bottom - layout.cta.top);
      }
      if (width === 393 && reducedMotion === 'reduce') {
        await page.locator('.story-ribbon').screenshot({ path: '.work/mobile-layout/iphone16-ribbon.png', scale: 'css' });
        await page.locator('.bottom-cta').screenshot({ path: '.work/mobile-layout/iphone16-cta.png', scale: 'css' });
      }
    }
  }
  expect(errors).toEqual([]);
});
