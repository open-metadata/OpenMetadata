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
import {
  DUMMY_GRAPH_DATA,
  DUMMY_GRAPH_DATA_WITH_MISSING_ENTITY,
} from 'mocks/DataInsight.mock';
import React from 'react';
import { getGraphDataByEntityType } from 'utils/DataInsightUtils';
import { INITIAL_CHART_FILTER } from '../../constants/DataInsight.constants';

import DescriptionInsight from './DescriptionInsight';

jest.mock('../../utils/DataInsightUtils', () => ({
  renderLegend: jest
    .fn()
    .mockReturnValue(<ul data-testid="graph-legend">Graph Legend</ul>),
  getGraphDataByEntityType: jest
    .fn()
    .mockImplementation(() => DUMMY_GRAPH_DATA),
}));
jest.mock('./DataInsightProgressBar', () => {
  return jest.fn().mockImplementation(({ startValue, successValue }) => (
    <div>
      DataInsightProgressBar.component
      <p data-testid={successValue}>{startValue}</p>
    </div>
  ));
});

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (label: string) => label,
  }),
}));

describe('Test DescriptionInsight Component', () => {
  it('Should render the graph', async () => {
    await act(async () => {
      const { container } = render(
        <DescriptionInsight
          chartFilter={INITIAL_CHART_FILTER}
          kpi={undefined}
          selectedDays={30}
        />
      );
      const card = screen.getByTestId('entity-description-percentage-card');

      const graph = queryByAttribute(
        'id',
        container,
        'description-summary-graph'
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
      const { container } = render(
        <DescriptionInsight
          chartFilter={INITIAL_CHART_FILTER}
          kpi={undefined}
          selectedDays={30}
        />
      );
      const card = screen.getByTestId('entity-description-percentage-card');

      const graph = queryByAttribute(
        'id',
        container,
        'description-summary-graph'
      );
      const missingEntityValue = await screen.findByTestId('Table');

      expect(card).toBeInTheDocument();
      expect(graph).toBeInTheDocument();
      expect(missingEntityValue).toBeInTheDocument();
      expect(missingEntityValue.textContent).toBe('0');
    });
  });
});
