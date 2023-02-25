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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DataInsightTabs } from '../../interface/data-insight.interface';
import DataInsightPage from './DataInsightPage.component';

let activeTab = DataInsightTabs.DATA_ASSETS;

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({ push: jest.fn() }),
  useParams: jest.fn().mockImplementation(() => ({ tab: activeTab })),
}));

jest.mock('components/containers/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <>{children}</>)
);

jest.mock('components/DataInsightDetail/DataInsightSummary', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="data-insight-summary">DataInsight Summary</div>
    )
);

jest.mock('components/DataInsightDetail/DescriptionInsight', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="description-insight">DescriptionInsight</div>
    )
);

jest.mock('components/DataInsightDetail/OwnerInsight', () =>
  jest.fn().mockReturnValue(<div data-testid="owner-insight">OwnerInsight</div>)
);

jest.mock('components/DataInsightDetail/TierInsight', () =>
  jest.fn().mockReturnValue(<div data-testid="tier-insight">TierInsight</div>)
);

jest.mock('components/DataInsightDetail/TopActiveUsers', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="top-active-user">TopActiveUsers</div>)
);

jest.mock('components/DataInsightDetail/TopViewEntities', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="top-viewed-entities">TopViewEntities</div>
    )
);

jest.mock('components/DataInsightDetail/TotalEntityInsight', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="total-entity-insight">TotalEntityInsight</div>
    )
);

jest.mock('../../utils/DataInsightUtils', () => ({
  getTeamFilter: jest.fn().mockReturnValue([]),
}));

jest.mock('components/DataInsightDetail/DailyActiveUsersChart', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="daily-active-users">DailyActiveUsersChart</div>
    )
);
jest.mock('components/DataInsightDetail/PageViewsByEntitiesChart', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="entities-page-views">PageViewsByEntitiesChart</div>
    )
);
jest.mock('components/DataInsightDetail/KPIChart', () =>
  jest.fn().mockReturnValue(<div data-testid="kpi-chart">KPIChart</div>)
);

jest.mock('./KPIList', () =>
  jest.fn().mockReturnValue(<div data-testid="kpi-list">KPI List</div>)
);

jest.mock('./DataInsightLeftPanel', () =>
  jest.fn().mockReturnValue(<div data-testid="left-panel">Left panel</div>)
);

describe('Test DataInsightPage Component', () => {
  it('Should render all child elements', async () => {
    render(<DataInsightPage />);

    const container = screen.getByTestId('data-insight-container');
    const insightSummary = screen.getByTestId('data-insight-summary');
    const descriptionInsight = screen.getByTestId('description-insight');
    const ownerInsight = screen.getByTestId('owner-insight');
    const tierInsight = screen.getByTestId('tier-insight');

    const totalEntityInsight = screen.getByTestId('total-entity-insight');

    expect(container).toBeInTheDocument();

    expect(insightSummary).toBeInTheDocument();
    expect(descriptionInsight).toBeInTheDocument();
    expect(ownerInsight).toBeInTheDocument();
    expect(tierInsight).toBeInTheDocument();

    expect(totalEntityInsight).toBeInTheDocument();
  });

  it('Should not render the KPI chart for app analytics', async () => {
    activeTab = DataInsightTabs.APP_ANALYTICS;

    await act(async () => {
      render(<DataInsightPage />, { wrapper: MemoryRouter });
    });

    const kpiChart = screen.queryByTestId('kpi-chart');

    expect(kpiChart).toBeNull();
  });

  it('Should not render the insights summary for KPIs', async () => {
    activeTab = DataInsightTabs.KPIS;

    await act(async () => {
      render(<DataInsightPage />, { wrapper: MemoryRouter });
    });

    const dataInsightsSummary = screen.queryByTestId('data-insight-summary');

    expect(dataInsightsSummary).toBeNull();
  });
});
