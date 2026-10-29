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
import { CLASSIC_TOUR_STEPS } from '../constants/product-tour/classicTour.constants';
import productTourClassBase from './ProductTourClassBase';

describe('ProductTourClassBase', () => {
  it('runs the Classic tour, in Classic mode, from either mode', () => {
    expect(productTourClassBase.getTour('default')).toMatchObject({
      mode: 'default',
      steps: CLASSIC_TOUR_STEPS,
    });
    expect(productTourClassBase.getTour('ai').mode).toBe('default');
  });

  it('gives every step a route, a target and copy', () => {
    CLASSIC_TOUR_STEPS.forEach((step) => {
      expect(step.route).toMatch(/^\//);
      expect(step.selector).not.toBe('');
      expect(step.i18nKey).toMatch(/^message\.product-tour-step-/);
      expect(step.labelKey).toMatch(/^label\./);
    });
  });

  it('serves the Classic pages from recorded fixtures', async () => {
    const fixtures = await productTourClassBase
      .getTour('default')
      .loadFixtures();

    expect(fixtures.length).toBeGreaterThan(0);

    fixtures.forEach((fixture) => {
      expect(fixture.path).toMatch(/^\//);
      expect(['get', 'post']).toContain(fixture.method);
    });
  });

  it('points a step without its target at the page content', () => {
    expect(productTourClassBase.getPageSelector()).toBe('[data-tour-page]');
  });

  it('finds every target by its tour marker, never a test id', () => {
    CLASSIC_TOUR_STEPS.forEach(({ selector }) => {
      expect(selector).toMatch(/^\[data-tour-step="[a-z-]+"\]$/);
    });
  });
});
