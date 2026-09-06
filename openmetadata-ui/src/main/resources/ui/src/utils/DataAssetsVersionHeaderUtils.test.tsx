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

import { render } from '@testing-library/react';
import { EntityType } from '../enums/entity.enum';
import {
  MetricType,
  UnitOfMeasurement,
  type Metric,
} from '../generated/entity/data/metric';
import { getDataAssetsVersionHeaderInfo } from './DataAssetsVersionHeaderUtils';

// Regression guard for the METRIC branch of `getDataAssetsVersionHeaderInfo`.
//
// `UnitOfMeasurement` is a runtime enum that is dereferenced as
// `UnitOfMeasurement.Other` inside the METRIC case. A prior mechanical refactor
// rewrote its import to `import type { UnitOfMeasurement }`, which is erased at
// emit time (esbuild / ts-jest under `isolatedModules`), leaving the name
// unbound and crashing the whole Metric version-history page with
// `ReferenceError: UnitOfMeasurement is not defined`. These cases exercise the
// runtime value use so that class of regression cannot recur silently.

const createMetric = (overrides: Partial<Metric> = {}): Metric => ({
  id: 'metric-id',
  name: 'my-metric',
  ...overrides,
});

describe('getDataAssetsVersionHeaderInfo - EntityType.METRIC', () => {
  it('does not throw ReferenceError and substitutes the custom unit when unitOfMeasurement is OTHER', () => {
    const metricData = createMetric({
      metricType: MetricType.Simple,
      unitOfMeasurement: UnitOfMeasurement.Other,
      customUnitOfMeasurement: 'widgets/hour',
    });

    const { container } = render(
      <>{getDataAssetsVersionHeaderInfo(EntityType.METRIC, metricData)}</>
    );

    // The custom unit is rendered in place of the raw "OTHER" token.
    expect(container.textContent).toContain('widgets/hour');
    expect(container.textContent).not.toContain('OTHER');
  });

  it('renders the raw OTHER unit when the unit is OTHER but no customUnitOfMeasurement is configured', () => {
    const metricData = createMetric({
      unitOfMeasurement: UnitOfMeasurement.Other,
    });

    const { container } = render(
      <>{getDataAssetsVersionHeaderInfo(EntityType.METRIC, metricData)}</>
    );

    // The `&& customUnitOfMeasurement` short-circuit falls through to the raw unit.
    expect(container.textContent).toContain('OTHER');
  });

  it('renders the raw unit and does not bleed the custom unit when unitOfMeasurement is not OTHER', () => {
    const metricData = createMetric({
      metricType: MetricType.Simple,
      unitOfMeasurement: UnitOfMeasurement.Count,
      customUnitOfMeasurement: 'widgets/hour',
    });

    const { container } = render(
      <>{getDataAssetsVersionHeaderInfo(EntityType.METRIC, metricData)}</>
    );

    expect(container.textContent).toContain('COUNT');
    expect(container.textContent).not.toContain('widgets/hour');
  });
});
