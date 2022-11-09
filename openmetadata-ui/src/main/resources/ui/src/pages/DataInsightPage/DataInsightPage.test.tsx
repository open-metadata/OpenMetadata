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

import {
  act,
  fireEvent,
  getByText,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import DataInsightPage from './DataInsightPage.component';

jest.mock('../../components/containers/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <>{children}</>)
);

jest.mock('../../components/DataInsightDetail/DataInsightSummary', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="data-insight-summary">DataInsight Summary</div>
    )
);

jest.mock('../../components/DataInsightDetail/DescriptionInsight', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="description-insight">DescriptionInsight</div>
    )
);

jest.mock('../../components/DataInsightDetail/OwnerInsight', () =>
  jest.fn().mockReturnValue(<div data-testid="owner-insight">OwnerInsight</div>)
);

jest.mock('../../components/DataInsightDetail/TierInsight', () =>
  jest.fn().mockReturnValue(<div data-testid="tier-insight">TierInsight</div>)
);

jest.mock('../../components/DataInsightDetail/TopActiveUsers', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="top-active-user">TopActiveUsers</div>)
);

jest.mock('../../components/DataInsightDetail/TopViewEntities', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="top-viewed-entities">TopViewEntities</div>
    )
);

jest.mock('../../components/DataInsightDetail/TotalEntityInsight', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="total-entity-insight">TotalEntityInsight</div>
    )
);

jest.mock('../../utils/DataInsightUtils', () => ({
  getMenuItems: jest.fn().mockReturnValue(
    <select>
      <option value="option1">option1</option>
      <option value="option2">option2</option>
    </select>
  ),
}));

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

  it('Should render the web analytics when tab is switch to web analytics', async () => {
    render(<DataInsightPage />);

    const switchContainer = screen.getByTestId('data-insight-switch');

    const webAnalyticsButton = getByText(switchContainer, 'Web Analytics');

    act(() => {
      fireEvent.click(webAnalyticsButton);
    });

    const topActiveUser = screen.getByTestId('top-active-user');
    const topViewedEntities = screen.getByTestId('top-viewed-entities');

    expect(topActiveUser).toBeInTheDocument();
    expect(topViewedEntities).toBeInTheDocument();
  });
});
