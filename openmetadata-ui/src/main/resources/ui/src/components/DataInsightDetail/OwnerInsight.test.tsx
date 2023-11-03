/*
 *  Copyright 2022 Collate.
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

import { act, queryByAttribute, render, screen } from '@testing-library/react';
import React from 'react';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import {
  DUMMY_GRAPH_DATA,
  DUMMY_GRAPH_DATA_WITH_MISSING_ENTITY,
} from '../../mocks/DataInsight.mock';
import { getAggregateChartData } from '../../rest/DataInsightAPI';
import { getGraphDataByEntityType } from '../../utils/DataInsightUtils';
import OwnerInsight from './OwnerInsight';

const mockProps = {
  chartFilter: { endTs: 1692965371951, startTs: 1692706171951 },
  kpi: undefined,
  selectedDays: 30,
  dataInsightChartName:
    DataInsightChartType.PercentageOfEntitiesWithOwnerByType,
};

jest.mock('../../utils/DataInsightUtils', () => ({
  renderLegend: jest
    .fn()
    .mockReturnValue(<ul data-testid="graph-legend">Graph Legend</ul>),
  getGraphDataByEntityType: jest
    .fn()
    .mockImplementation(() => DUMMY_GRAPH_DATA),
}));
jest.mock('./EntitySummaryProgressBar.component', () => {
  return jest.fn().mockImplementation(({ label, entity }) => (
    <div>
      EntitySummaryProgressBar.component
      <p data-testid={entity}>{label}</p>
    </div>
  ));
});
jest.mock('../../rest/DataInsightAPI', () => ({
  getAggregateChartData: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (label: string) => label,
  }),
}));

describe('Test DescriptionInsight Component', () => {
  it('Should render the graph', async () => {
    await act(async () => {
      const { container } = render(<OwnerInsight {...mockProps} />);
      const card = screen.getByTestId('entity-summary-card-percentage');

      const graph = queryByAttribute(
        'id',
        container,
        `${mockProps.dataInsightChartName}-graph`
      );

      expect(card).toBeInTheDocument();
      expect(graph).toBeInTheDocument();
    });
  });

  it('Should render the graph and progress bar even if one entity dont have values', async () => {
    (getGraphDataByEntityType as jest.Mock).mockImplementationOnce(
      () => DUMMY_GRAPH_DATA_WITH_MISSING_ENTITY
    );
    await act(async () => {
      const { container } = render(<OwnerInsight {...mockProps} />);
      const card = screen.getByTestId('entity-summary-card-percentage');

      const graph = queryByAttribute(
        'id',
        container,
        `${mockProps.dataInsightChartName}-graph`
      );
      const missingEntityValue = await screen.findByTestId('Table');

      expect(card).toBeInTheDocument();
      expect(graph).toBeInTheDocument();
      expect(missingEntityValue).toBeInTheDocument();
      expect(missingEntityValue.textContent).toBe('0');
    });
  });

  it('Should fetch data based on dataInsightChartName props', async () => {
    const mockGetAggregateChartData = getAggregateChartData as jest.Mock;
    await act(async () => {
      render(<OwnerInsight {...mockProps} />);
    });

    expect(mockGetAggregateChartData).toHaveBeenCalledWith({
      dataInsightChartName: mockProps.dataInsightChartName,
      dataReportIndex: 'entity_report_data_index',
      endTs: mockProps.chartFilter.endTs,
      startTs: mockProps.chartFilter.startTs,
    });
  });
});
