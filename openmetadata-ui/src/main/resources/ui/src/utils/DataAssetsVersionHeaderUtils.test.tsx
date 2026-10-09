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
import { Pipeline } from '../generated/entity/data/pipeline';
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

  // The external-link icon rendered by the no-change branch is a sibling of
  // the entity-name link inside `.d-flex.items-center.text-xs`. SVGR is mocked
  // in jsdom (the inner element is `<svg-mock>`), so query the antd `Icon`
  // wrapper span (`.anticon`) rather than the `<svg>`.
  const querySourceUrlIcon = () =>
    document.querySelector('.d-flex.items-center.text-xs > .anticon');

  it.each([
    ['https://airflow.example.com/dag', true],
    ['javascript:alert(1)', false],
    ['airflow.example.com/dags/etl', false],
  ])(
    'should only render a clickable sourceUrl link + icon on the no-change branch for http(s): %s',
    (sourceUrl, isLink) => {
      const pipeline = {
        id: 'id',
        name: 'etl',
        sourceUrl,
        changeDescription: {
          fieldsAdded: [],
          fieldsUpdated: [],
          fieldsDeleted: [],
        },
      } as unknown as Pipeline;

      render(
        <>{getDataAssetsVersionHeaderInfo(EntityType.PIPELINE, pipeline)}</>
      );

      const nameAnchor = screen.getByText('etl').closest('a');
      const sourceUrlIcon = querySourceUrlIcon();

      if (isLink) {
        expect(nameAnchor).toHaveAttribute('href', sourceUrl);
        expect(sourceUrlIcon).toBeInTheDocument();
      } else {
        // Non-http sourceUrl must not render an inert anchor or a misleading
        // external-link icon; the entity name falls back to plain text.
        expect(nameAnchor).toBeNull();
        expect(sourceUrlIcon).not.toBeInTheDocument();
      }
    }
  );

  it.each([
    ['https://airflow.example.com/dag', true],
    ['javascript:alert(1)', false],
    ['airflow.example.com/dags/etl', false],
  ])(
    'should only render a clickable diff link on the fieldsUpdated branch for http(s): %s',
    (sourceUrl, isLink) => {
      const pipeline = {
        id: 'id',
        name: 'etl',
        sourceUrl,
        changeDescription: {
          fieldsAdded: [],
          fieldsDeleted: [],
          fieldsUpdated: [
            { name: 'sourceUrl', oldValue: '', newValue: sourceUrl },
          ],
        },
      } as unknown as Pipeline;

      render(
        <>{getDataAssetsVersionHeaderInfo(EntityType.PIPELINE, pipeline)}</>
      );

      const anchors = document.querySelectorAll('a');
      const sourceUrlIcon = querySourceUrlIcon();

      if (isLink) {
        expect(anchors).toHaveLength(1);
        expect(anchors[0]).toHaveAttribute('href', sourceUrl);
      } else {
        // Non-http sourceUrl: the diff text renders as plain text, never an
        // inert anchor (safe-link contract matches the other sourceUrl sinks).
        expect(anchors).toHaveLength(0);
      }

      // VersionExtraInfoLink never renders the external-link icon (by design).
      expect(sourceUrlIcon).not.toBeInTheDocument();
    }
  );

  it('should render nothing on the no-change branch when there is no sourceUrl', () => {
    const pipeline = {
      id: 'id',
      name: 'etl',
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [],
        fieldsDeleted: [],
      },
    } as unknown as Pipeline;

    render(
      <>{getDataAssetsVersionHeaderInfo(EntityType.PIPELINE, pipeline)}</>
    );

    expect(screen.queryByText('etl')).not.toBeInTheDocument();
    expect(document.querySelectorAll('a')).toHaveLength(0);
    expect(querySourceUrlIcon()).not.toBeInTheDocument();
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
