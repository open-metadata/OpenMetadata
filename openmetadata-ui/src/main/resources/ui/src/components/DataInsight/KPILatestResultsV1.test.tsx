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
import { findByTestId, render, screen } from '@testing-library/react';
import { UIKpiResult } from '../../interface/data-insight.interface';
import KPILatestResultsV1 from './KPILatestResultsV1';

const mockProps = {
  'description-coverage-completed-description-fraction': {
    timestamp: 1701396413075,
    kpiFqn: 'description-coverage-completed-description-fraction',
    targetResult: [
      {
        name: 'completedDescriptionFraction',
        value: '0.011024667232034217',
        targetMet: false,
      },
    ],
    target: 0.5,
    metricType: 'PERCENTAGE',
    startDate: 1682578800000,
    endDate: 1701417599999,
    displayName: 'Description coverage',
  },
  'ownership-coverage-has-owner-fraction': {
    timestamp: 1701657483456,
    kpiFqn: 'ownership-coverage-has-owner-fraction',
    targetResult: [
      {
        name: 'hasOwnerFraction',
        value: '0.65',
        targetMet: true,
      },
    ],
    target: 0.6,
    metricType: 'PERCENTAGE',
    startDate: 1696876200000,
    endDate: 1706725799999,
    displayName: 'Ownership Coverage',
  },
} as Record<string, UIKpiResult>;

jest.mock('../../utils/DataInsightUtils', () => ({
  getKpiResultFeedback: jest.fn(),
}));

describe('KPILatestResultsV1', () => {
  it('Component. should render', async () => {
    render(<KPILatestResultsV1 kpiLatestResultsRecord={mockProps} />);

    const [descriptionKPI, ownerKPI] = Object.keys(mockProps);

    expect(
      await screen.findByTestId('kpi-latest-result-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId(descriptionKPI)).toBeInTheDocument();
    expect(await screen.findByTestId(ownerKPI)).toBeInTheDocument();
  });

  it('If target is not met withing the time frame, it should show the 0 days left', async () => {
    render(<KPILatestResultsV1 kpiLatestResultsRecord={mockProps} />);
    const [descriptionKPI] = Object.keys(mockProps);
    const kpi = await screen.findByTestId(descriptionKPI);

    expect(kpi).toBeInTheDocument();

    expect(await findByTestId(kpi, 'kpi-days-remaining')).toHaveTextContent(
      '0'
    );
  });

  it('If target is met withing the time frame, it should show the success icon', async () => {
    render(<KPILatestResultsV1 kpiLatestResultsRecord={mockProps} />);
    const [, ownerKip] = Object.keys(mockProps);
    const kpi = await screen.findByTestId(ownerKip);

    expect(kpi).toBeInTheDocument();

    expect(await findByTestId(kpi, 'kpi-success')).toBeInTheDocument();
  });
});
