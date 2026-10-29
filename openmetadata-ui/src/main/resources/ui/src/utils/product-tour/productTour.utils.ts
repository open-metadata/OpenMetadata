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
import { ProductTourStep } from '../../interface/product-tour/productTour.interface';

/**
 * Visited routes stay mounted in the AI shell's route cache, hidden and
 * `inert`, so a step's selector skips them and matches only the page on show.
 */
export const onVisiblePage = (step: ProductTourStep): ProductTourStep => ({
  ...step,
  selector: `${step.selector}:not([inert] *)`,
});

/**
 * The step a page belongs to, for following the browser's Back and Forward
 * buttons: its first step, also when the page has redirected deeper (a bare
 * /glossary opens its first glossary). -1 when the page is not on the tour.
 */
export const getTourStepIndexForPath = (
  steps: ProductTourStep[],
  pathname: string
) => {
  const index = steps.findIndex(({ route }) => route === pathname);

  return index === -1
    ? steps.findIndex(({ route }) => pathname.startsWith(`${route}/`))
    : index;
};
