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
import { getTourStepIndexForPath, onVisiblePage } from './productTour.utils';

const step = (route: string) => ({
  route,
  selector: `#${route.replaceAll('/', '')}`,
  i18nKey: 'message.product-tour-step-explore',
  labelKey: 'label.explore',
});

const STEPS = [step('/'), step('/'), step('/explore'), step('/glossary')];

describe('productTour utils', () => {
  it('matches only the page on show, not the hidden cached ones', () => {
    expect(onVisiblePage(step('/explore')).selector).toBe(
      '#explore:not([inert] *)'
    );
  });

  it('finds the first step of a page', () => {
    expect(getTourStepIndexForPath(STEPS, '/')).toBe(0);
    expect(getTourStepIndexForPath(STEPS, '/explore')).toBe(2);
  });

  it('finds the page a step redirected deeper into', () => {
    expect(
      getTourStepIndexForPath(STEPS, '/glossary/Business%20Glossary')
    ).toBe(3);
  });

  it('is -1 for a page that is not on the tour', () => {
    expect(getTourStepIndexForPath(STEPS, '/settings')).toBe(-1);
  });
});
