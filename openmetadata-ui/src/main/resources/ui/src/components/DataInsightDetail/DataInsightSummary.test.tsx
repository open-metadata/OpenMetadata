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
import DataInsightSummary from './DataInsightSummary';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (label: string) => label,
  }),
}));

describe('Test DataInsightSummary Component', () => {
  it('Should render the overview data', async () => {
    render(<DataInsightSummary />);

    const summaryCard = screen.getByTestId('summary-card');

    const allEntityCount = screen.getByTestId('summary-item-All');
    const usersCount = screen.getByTestId('summary-item-Users');
    const sessionCount = screen.getByTestId('summary-item-Sessions');
    const activityCount = screen.getByTestId('summary-item-Activity');
    const activeUsersCount = screen.getByTestId('summary-item-ActiveUsers');
    const tablesCount = screen.getByTestId('summary-item-Tables');
    const topicsCount = screen.getByTestId('summary-item-Topics');
    const dashboardCount = screen.getByTestId('summary-item-Dashboards');
    const mlModelsCount = screen.getByTestId('summary-item-MlModels');
    const testCasesCount = screen.getByTestId('summary-item-TestCases');

    expect(summaryCard).toBeInTheDocument();
    expect(allEntityCount).toBeInTheDocument();
    expect(usersCount).toBeInTheDocument();
    expect(sessionCount).toBeInTheDocument();
    expect(activityCount).toBeInTheDocument();
    expect(activeUsersCount).toBeInTheDocument();
    expect(tablesCount).toBeInTheDocument();
    expect(topicsCount).toBeInTheDocument();
    expect(dashboardCount).toBeInTheDocument();
    expect(mlModelsCount).toBeInTheDocument();
    expect(testCasesCount).toBeInTheDocument();
  });
});
