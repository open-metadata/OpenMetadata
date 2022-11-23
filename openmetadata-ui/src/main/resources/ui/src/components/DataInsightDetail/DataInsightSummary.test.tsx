/*
 *  Copyright 2021 Collate
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
import React from 'react';
import { act } from 'react-test-renderer';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import DataInsightSummary from './DataInsightSummary';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (label: string) => label,
  }),
}));

const mockFilter = {
  startTs: 1667952000000,
  endTs: 1668000248671,
};

const mockScrollFunction = jest.fn();

jest.mock('../../axiosAPIs/DataInsightAPI', () => ({
  getAggregateChartData: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test DataInsightSummary Component', () => {
  it('Should render the overview data', async () => {
    await act(async () => {
      render(
        <DataInsightSummary
          chartFilter={mockFilter}
          onScrollToChart={mockScrollFunction}
        />
      );
    });

    const summaryCard = screen.getByTestId('summary-card');

    const totalEntitiesByType = screen.getByTestId(
      `summary-item-${DataInsightChartType.TotalEntitiesByType}`
    );

    expect(summaryCard).toBeInTheDocument();
    expect(totalEntitiesByType).toBeInTheDocument();
  });
});
