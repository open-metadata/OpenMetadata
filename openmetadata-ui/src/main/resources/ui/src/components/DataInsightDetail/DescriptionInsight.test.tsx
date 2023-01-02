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
import { INITIAL_CHART_FILTER } from '../../constants/DataInsight.constants';

import DescriptionInsight from './DescriptionInsight';

jest.mock('../../utils/DataInsightUtils', () => ({
  renderLegend: jest
    .fn()
    .mockReturnValue(<ul data-testid="graph-legend">Graph Legend</ul>),
  getGraphDataByEntityType: jest.fn().mockImplementation(() => ({
    data: [
      {
        timestamp: '27/Oct',
        Table: 0.5674,
        Topic: 0.0453,
        Database: 0.9874,
        Pipeline: 0.5432,
        Messaging: 0.3215,
      },
      {
        timestamp: '25/Oct',
        Table: 0.3674,
        Topic: 0.0353,
        Database: 0.9874,
        Pipeline: 0.4432,
        Messaging: 0.3115,
      },
      {
        timestamp: '24/Oct',
        Table: 0.3374,
        Topic: 0.0353,
        Database: 0.9774,
        Pipeline: 0.4482,
        Messaging: 0.3105,
      },
    ],
    entities: ['Table', 'Topic', 'Database', 'Pipeline', 'Messaging'],
    latestData: {
      timestamp: '24/Oct',
      Table: 0.3374,
      Topic: 0.0353,
      Database: 0.9774,
      Pipeline: 0.4482,
      Messaging: 0.3105,
    },
  })),
}));

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
});
