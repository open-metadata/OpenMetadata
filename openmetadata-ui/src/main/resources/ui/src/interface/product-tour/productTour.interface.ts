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

/** One page section the tour highlights. */
export interface ProductTourStep {
  /** The route the step is on; the tour navigates there before showing it. */
  route: string;
  /** What the step highlights. When it is missing, the step points at the page. */
  selector: string;
  /** The step's copy, with `<0>{{text}}</0>` for the bold label. */
  i18nKey: string;
  /** The bold label, usually the feature's name. */
  labelKey: string;
  /** Where the popover goes; react-tour picks a side when omitted. */
  position?: 'top' | 'right' | 'bottom' | 'left';
}

/** A recorded API response the tour serves instead of the server. */
export interface ProductTourFixture {
  method: string;
  /** Path relative to the API base, e.g. `/search/query`. */
  path: string;
  /** Query parameters, without the volatile ones (`TOUR_VOLATILE_QUERY_PARAMS`). */
  query?: Record<string, string>;
  /** The request body, for reads sent as a POST such as a search. */
  body?: string;
  status?: number;
  data: unknown;
}

/** A tour: the app mode it runs in, its steps, and the data its pages show. */
export interface ProductTourDefinition {
  mode: string;
  steps: ProductTourStep[];
  loadFixtures: () => Promise<ProductTourFixture[]>;
}
