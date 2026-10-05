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

const mockMetric = {
  id: 'id',
  name: 'campaign_conversion_rate',
  metricType: MetricType.Conversion,
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
    expect(screen.getByText(MetricType.Conversion)).toBeInTheDocument();
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

  describe('metric unit version diff direction', () => {
    const baseMetric = {
      id: 'id',
      name: 'campaign_conversion_rate',
      metricType: MetricType.Conversion,
      granularity: MetricGranularity.Day,
    } as unknown as Metric;

    // The to-Other version: unit switched TO Other and the custom unit is set
    // in the same version. Both fields appear together in fieldsUpdated.
    const toOtherChangeDescription = {
      fieldsAdded: [],
      fieldsDeleted: [],
      fieldsUpdated: [
        {
          name: 'unitOfMeasurement',
          oldValue: UnitOfMeasurement.Percentage,
          newValue: UnitOfMeasurement.Other,
        },
        { name: 'customUnitOfMeasurement', oldValue: '', newValue: 'Leads' },
      ],
    };

    it('to-Other: shows the custom unit (with diff) when unit changed TO Other in the same version', () => {
      const metricWithChange = {
        ...baseMetric,
        unitOfMeasurement: UnitOfMeasurement.Other,
        customUnitOfMeasurement: 'Leads',
        changeDescription: toOtherChangeDescription,
      } as unknown as Metric;

      render(
        <>
          {getDataAssetsVersionHeaderInfo(EntityType.METRIC, metricWithChange)}
        </>
      );

      const unitSlot = screen.getByTestId('unit-of-measurement-version-info');

      expect(unitSlot).toHaveTextContent('Leads');
      expect(unitSlot).not.toHaveTextContent(UnitOfMeasurement.Percentage);
      expect(unitSlot).not.toHaveTextContent(UnitOfMeasurement.Other);
      // The custom unit is the newly added value, so it carries diff styling.
      expect(screen.getByTestId('diff-added')).toHaveTextContent('Leads');
    });

    it('from-Other: shows the unit diff (not the custom unit) when unit changed FROM Other', () => {
      const metricWithChange = {
        ...baseMetric,
        unitOfMeasurement: UnitOfMeasurement.Dollars,
        customUnitOfMeasurement: '',
        changeDescription: {
          fieldsAdded: [],
          fieldsDeleted: [],
          fieldsUpdated: [
            {
              name: 'unitOfMeasurement',
              oldValue: UnitOfMeasurement.Other,
              newValue: UnitOfMeasurement.Dollars,
            },
            {
              name: 'customUnitOfMeasurement',
              oldValue: 'Leads',
              newValue: '',
            },
          ],
        },
      } as unknown as Metric;

      render(
        <>
          {getDataAssetsVersionHeaderInfo(EntityType.METRIC, metricWithChange)}
        </>
      );

      const unitSlot = screen.getByTestId('unit-of-measurement-version-info');

      expect(unitSlot).toHaveTextContent(UnitOfMeasurement.Other);
      expect(unitSlot).toHaveTextContent(UnitOfMeasurement.Dollars);
      expect(unitSlot).not.toHaveTextContent('Leads');
    });
  });
});
