import type { Page } from 'puppeteer-core';

declare global {
  var page: Page | null;
}
