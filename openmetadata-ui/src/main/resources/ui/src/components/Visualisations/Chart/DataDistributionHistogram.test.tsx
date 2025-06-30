/*
 *  Copyright 2023 Collate.
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

import { queryByAttribute, render, screen } from '@testing-library/react';
import DataDistributionHistogram from './DataDistributionHistogram.component';

const MOCK_HISTOGRAM_DATA = [
  {
    name: 'shop_id',
    timestamp: 1678375427,
    valuesCount: 14567.0,
    nullCount: 0.0,
    nullProportion: 0.0,
    uniqueCount: 14567.0,
    uniqueProportion: 1.0,
    distinctCount: 14509.0,
    distinctProportion: 1.0,
    min: 1.0,
    max: 587.0,
    mean: 45.0,
    sum: 1367.0,
    stddev: 35.0,
    median: 7654.0,
    firstQuartile: 7.4,
    thirdQuartile: 8766.5,
    interQuartileRange: 8002.1,
    nonParametricSkew: -0.567,
    histogram: {
      boundaries: [
        '5.00 to 100.00',
        '100.00 to 200.00',
        '200.00 to 300.00',
        '300.00 and up',
      ],
      frequencies: [101, 235, 123, 98],
    },
  },
  {
    name: 'shop_id',
    timestamp: 1678202627,
    valuesCount: 10256.0,
    nullCount: 0.0,
    nullProportion: 0.0,
    uniqueCount: 10098.0,
    uniqueProportion: 0.91,
    distinctCount: 10256.0,
    distinctProportion: 1.0,
    min: 1.0,
    max: 542.0,
    mean: 45.0,
    sum: 1367.0,
    stddev: 35.0,
    median: 7344.0,
    firstQuartile: 7.4,
    thirdQuartile: 8005.5,
    interQuartileRange: 8069.1,
    nonParametricSkew: -0.567,
    histogram: {
      boundaries: [
        '5.00 to 100.00',
        '100.00 to 200.00',
        '200.00 to 300.00',
        '300.00 and up',
      ],
      frequencies: [56, 62, 66, 99],
    },
  },
];

const COLUMN_PROFILER = {
  name: 'shop_id',
  timestamp: 1678169698,
  valuesCount: 10256.0,
  nullCount: 0.0,
  nullProportion: 0.0,
  uniqueCount: 10098.0,
  uniqueProportion: 0.91,
  distinctCount: 10256.0,
  distinctProportion: 1.0,
  min: 1.0,
  max: 542.0,
  mean: 45.0,
  sum: 1367.0,
  stddev: 35.0,
  median: 7344.0,
};

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>);
});

describe('DataDistributionHistogram component test', () => {
  it('Component should render', async () => {
    const { container } = render(
      <DataDistributionHistogram
        data={{
          firstDayData: MOCK_HISTOGRAM_DATA[1],
          currentDayData: MOCK_HISTOGRAM_DATA[0],
        }}
      />
    );
    const skewTags = await screen.findAllByTestId('skew-tag');
    const date = await screen.findAllByTestId('date');

    expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
    expect(
      queryByAttribute('id', container, 'firstDayData-histogram')
    ).toBeInTheDocument();
    expect(
      queryByAttribute('id', container, 'currentDayData-histogram')
    ).toBeInTheDocument();
    expect(skewTags).toHaveLength(2);
    expect(date).toHaveLength(2);
  });

  it('Render one graph if histogram data is available in only one profile data', async () => {
    const { container } = render(
      <DataDistributionHistogram
        data={{
          firstDayData: COLUMN_PROFILER,
          currentDayData: MOCK_HISTOGRAM_DATA[0],
        }}
      />
    );
    const skewTags = await screen.findAllByTestId('skew-tag');
    const date = await screen.findAllByTestId('date');

    expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
    expect(
      queryByAttribute('id', container, 'firstDayData-histogram')
    ).not.toBeInTheDocument();
    expect(
      queryByAttribute('id', container, 'currentDayData-histogram')
    ).toBeInTheDocument();
    expect(skewTags).toHaveLength(1);
    expect(date).toHaveLength(1);
  });

  it('No data placeholder should render when firstDay & currentDay data is undefined', async () => {
    render(
      <DataDistributionHistogram
        data={{
          firstDayData: undefined,
          currentDayData: undefined,
        }}
      />
    );

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });
});
