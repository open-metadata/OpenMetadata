/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { Page } from '@playwright/test';

export const mockScoreMode = 'first';
export const mockBoostMode = 'replace';
export const mockEntitySearchSettings = {
  key: 'search-settings/table',
  url: '/settings/preferences/search-settings/table',
};

export async function setSliderValue(
  page: Page,
  testId: string,
  value: number,
  min = 0,
  max = 10
) {
  const sliderHandle = page.getByTestId(testId).locator('.ant-slider-handle');
  const sliderTrack = page.getByTestId(testId).locator('.ant-slider-track');

  // Get slider track dimensions
  const box = await sliderTrack.boundingBox();
  if (!box) {
    throw new Error('Slider track not found');
  }

  const { x, width } = box;

  // Calculate the exact x-position for the value
  const valuePosition = x + ((value - min) / (max - min)) * width;

  // Move the slider handle to the calculated position
  await sliderHandle.hover(); // Ensure visibility
  await page.mouse.down();
  await page.mouse.move(valuePosition, box.y);
  await page.mouse.up();
}
