/**
 * Copyright 2024 Docker Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DesktopUI } from '@docker/extension-test-helper';
import { exec as originalExec } from 'child_process';
import { describe, beforeAll, afterAll, test } from '@jest/globals';
import * as util from 'util';
import { WaitForSelectorOptions } from 'puppeteer-core';

export const exec = util.promisify(originalExec);

let dashboard: DesktopUI;

beforeAll(async () => {
  if (process.env.SKIP_EXTENSION_IMAGE_BUILD != 'true') {
    console.log('starting building extension...');
    await exec(`projectcopacetic/copacetic-docker-desktop-extension:test`, {
      cwd: '../',
    });
    console.log('extension built');
  }
  // await exec(
  //   `docker container create --name e2e-test-container -v e2e-test-volume:/data hello-world`,
  // );
  // console.log('sample volume and container created');
  await exec(
    `docker extension install -f projectcopacetic/copacetic-docker-desktop-extension:test`,
  );
  console.log('extension installed');
});

afterAll(async () => {
  await dashboard?.stop();
  console.log('dashboard app closed');
  await exec(`docker extension uninstall projectcopacetic/copacetic-docker-desktop-extension:test`);
  console.log('extension uninstalled');
});

describe('Test Main Workflow of Extension', () => {
  test('display the patched image', async () => {
    dashboard = await DesktopUI.start();

    const eFrame = await dashboard.navigateToExtension(
      'projectcopacetic/copacetic-docker-desktop-extension',
    );

    const imageInput = await eFrame.waitForSelector("#image-select-combo-box");

    console.log('input nginx:1.21.6 image');
    await imageInput?.type('nginx:1.21.6');
    await imageInput?.dispose();

    const scanPatchImageButton = await eFrame.waitForSelector('#scan-or-patch-image-button');

    console.log('click scan button');
    await scanPatchImageButton?.click();

    const vulnDisplay = await eFrame.waitForSelector('#loaded-vuln-display-page', { timeout: 120000 });
    console.log('scan finished (vulns being displayed)')
    await vulnDisplay?.dispose();

    console.log('click patch button');
    await scanPatchImageButton?.click();
    await scanPatchImageButton?.dispose();

    const loadingText = await eFrame.waitForSelector('#loading-patch-text');
    console.log('confirm loading started');
    await loadingText?.dispose();

    const patchedImageElement = await eFrame.waitForSelector('#new-patched-image-name-text', { timeout: 240000 });
    console.log("scan finished (success)");
    let patchedImageText = "";
    const evalText = await patchedImageElement?.evaluate(element => element.textContent);
    if (evalText !== null && evalText !== undefined) {
      patchedImageText = evalText;
      console.log('created patched image: ' + evalText);
    }
    await patchedImageElement?.dispose();

    expect(patchedImageText).toBe("nginx:1.21.6-patched!");

    const output = await exec(`docker images`);
    console.log(output.stdout);

    expect(output.stdout.includes('nginx')).toBe(true);
    expect(output.stdout.includes('1.21.6-patched')).toBe(true);
  });
});
