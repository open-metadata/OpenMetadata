/*
 *  Copyright 2026 Collate.
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
import { TOUR_PASS_THROUGH_PATHS } from './productTour.constants';

// Outside src/, so loaded at run time rather than compiled with the app.
const { PRODUCT_TOUR_PASS_THROUGH_PATHS } = jest.requireActual<{
  PRODUCT_TOUR_PASS_THROUGH_PATHS: RegExp[];
}>('../../../playwright/constant/productTour');

describe('product tour constants', () => {
  // Playwright specs may not import app code, so the tour spec keeps a copy.
  it('keeps the spec copy of the pass-through paths in step', () => {
    expect(PRODUCT_TOUR_PASS_THROUGH_PATHS.map(String)).toEqual(
      TOUR_PASS_THROUGH_PATHS.map(String)
    );
  });
});
