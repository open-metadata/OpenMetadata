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
import { DEFAULT_APP_MODE } from '../constants/appMode.constants';
import {
  CLASSIC_TOUR_STEPS,
  TOUR_PAGE_SELECTOR,
} from '../constants/product-tour/classicTour.constants';
import {
  ProductTourDefinition,
  ProductTourFixture,
} from '../interface/product-tour/productTour.interface';

// One function for the app's lifetime: the tour mock reloads its fixtures only
// when the loader changes.
const loadClassicTourFixtures = async (): Promise<ProductTourFixture[]> => {
  const { default: fixtures } = await import(
    '../constants/product-tour/classicTour.fixtures.json'
  );

  return fixtures as ProductTourFixture[];
};

const CLASSIC_TOUR: ProductTourDefinition = {
  mode: DEFAULT_APP_MODE,
  steps: CLASSIC_TOUR_STEPS,
  loadFixtures: loadClassicTourFixtures,
};

/**
 * The product tour Help > Tour starts. A distribution overrides it to add its
 * own pages and fixtures, or a tour for another app mode.
 */
class ProductTourClassBase {
  /**
   * The tour for a user in `currentMode`. The tour runs in its own `mode`;
   * when that differs, the tour switches to it and back. Called again with
   * the tour's own mode when a reload resumes it.
   */
  public getTour(_currentMode: string): ProductTourDefinition {
    return CLASSIC_TOUR;
  }

  /** What a step whose target is missing points at: the page content. */
  public getPageSelector(): string {
    return TOUR_PAGE_SELECTOR;
  }
}

const productTourClassBase = new ProductTourClassBase();

export default productTourClassBase;

export { ProductTourClassBase };
