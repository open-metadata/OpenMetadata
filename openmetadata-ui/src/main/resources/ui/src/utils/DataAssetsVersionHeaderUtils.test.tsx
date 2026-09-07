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

import { render, screen } from '@testing-library/react';
import { EntityType } from '../enums/entity.enum';
import {
  Metric,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../generated/entity/data/metric';
import { getDataAssetsVersionHeaderInfo } from './DataAssetsVersionHeaderUtils';

// `MetricType.Conversion` (used by this test on main and 2.0) does not exist in
// 1.13's metric schema, so this uses `Ratio` instead. `Percentage` would collide
// with `UnitOfMeasurement.Percentage` below -- both render the text 'PERCENTAGE',
// which would make the getByText assertion ambiguous.
const mockMetric = {
  id: 'id',
  name: 'campaign_conversion_rate',
  metricType: MetricType.Ratio,
  unitOfMeasurement: UnitOfMeasurement.Percentage,
  granularity: MetricGranularity.Day,
  changeDescription: { fieldsAdded: [], fieldsUpdated: [], fieldsDeleted: [] },
} as unknown as Metric;

describe('DataAssetsVersionHeaderUtils', () => {
  it('should render metric version info without throwing', () => {
    render(
      <>{getDataAssetsVersionHeaderInfo(EntityType.METRIC, mockMetric)}</>
    );

    expect(screen.getByText(UnitOfMeasurement.Percentage)).toBeInTheDocument();
    expect(screen.getByText(MetricType.Ratio)).toBeInTheDocument();
    expect(screen.getByText(MetricGranularity.Day)).toBeInTheDocument();
  });

  it('should prefer customUnitOfMeasurement when unit is Other', () => {
    render(
      <>
        {getDataAssetsVersionHeaderInfo(EntityType.METRIC, {
          ...mockMetric,
          unitOfMeasurement: UnitOfMeasurement.Other,
          customUnitOfMeasurement: 'Leads',
        } as unknown as Metric)}
      </>
    );

    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(screen.queryByText(UnitOfMeasurement.Other)).not.toBeInTheDocument();
  });
});
