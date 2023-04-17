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

import {
  act,
  findAllByText,
  findByTestId,
  findByText,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedFilter } from 'enums/mydata.enum';
import { Thread } from 'generated/entity/feed/thread';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { formatDataResponse, SearchEntityHits } from '../../utils/APIUtils';
import {
  currentUserMockData,
  mockData,
  mockPaging,
} from './mocks/MyData.mocks';
import MyData from './MyData.component';
import { MyDataProps } from './MyData.interface';

const mockFetchFeedHandler = jest.fn();

jest.mock('rest/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockData })),
}));

jest.mock('components/searched-data/SearchedData', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div data-testid="search-data">
        <div data-testid="wrapped-content">{children}</div>
      </div>
    ));
});

jest.mock('../recently-viewed/RecentlyViewed', () => {
  return jest.fn().mockReturnValue(<p>RecentlyViewed</p>);
});

jest.mock('../dropdown/DropDownList', () => {
  return jest.fn().mockReturnValue(<p>DropDownList</p>);
});

jest.mock('../onboarding/Onboarding', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="Onboarding">Onboarding</div>)
);

jest.mock('../ActivityFeed/ActivityFeedList/ActivityFeedList', () =>
  jest.fn().mockImplementation(({ onFeedFiltersUpdate }) => (
    <div data-testid="activityFeedList">
      activityFeedList
      <div
        data-testid="onFeedFiltersUpdate"
        onClick={() => {
          onFeedFiltersUpdate(FeedFilter.ALL);
        }}>
        onFeedFiltersUpdate
      </div>
    </div>
  ))
);

jest.mock('../MyAssetStats/MyAssetStats.component', () => {
  return jest.fn().mockReturnValue(<p>MyAssetStats</p>);
});

jest.mock('../EntityList/EntityList', () => ({
  EntityListWithAntd: jest.fn().mockReturnValue(<p>EntityList.component</p>),
}));

jest.mock(
  '../containers/PageLayoutV1',
  () =>
    ({
      children,
      leftPanel,
      rightPanel,
    }: {
      children: ReactNode;
      rightPanel: ReactNode;
      leftPanel: ReactNode;
    }) =>
      (
        <div data-testid="PageLayoutV1">
          <div data-testid="left-panel-content">{leftPanel}</div>
          <div data-testid="right-panel-content">{rightPanel}</div>
          {children}
        </div>
      )
);

jest.mock('../../utils/ServiceUtils', () => ({
  getAllServices: jest
    .fn()
    .mockImplementation(() => Promise.resolve(['test', 'test2', 'test3'])),
  getEntityCountByService: jest
    .fn()
    .mockReturnValue({ tableCount: 4, topicCount: 5, dashboardCount: 6 }),
  getTotalEntityCountByService: jest.fn().mockReturnValue(2),
}));

jest.mock('../RecentSearchedTerms/RecentSearchedTermsAntd', () => {
  return jest
    .fn()
    .mockReturnValue(<div>RecentSearchedTermsAntd.component</div>);
});

const postFeed = jest.fn();

const mockProp: MyDataProps = {
  activityFeeds: [],
  data: {
    entityCounts: {
      dashboardCount: 8,
      mlmodelCount: 2,
      tableCount: 10,
      teamCount: 7,
      testSuiteCount: 0,
      topicCount: 5,
      servicesCount: 0,
      userCount: 100,
      pipelineCount: 1,
    },
    entityCountLoading: false,
  },
  pendingTaskCount: 0,
  followedDataCount: 5,
  ownedDataCount: 5,
  error: '',
  feedData: formatDataResponse(
    mockData.data.hits.hits as unknown as SearchEntityHits
  ) as unknown as Thread[],
  fetchFeedHandler: mockFetchFeedHandler,
  followedData: currentUserMockData,
  isFeedLoading: false,
  isLoadingOwnedData: false,
  ownedData: currentUserMockData,
  paging: mockPaging,
  postFeedHandler: postFeed,
  updateThreadHandler: jest.fn(),
};

describe('Test MyData page', () => {
  it('Check if there is an element in the page', async () => {
    const { container } = render(<MyData {...mockProp} />, {
      wrapper: MemoryRouter,
    });
    const pageLayout = await findByTestId(container, 'PageLayoutV1');
    const leftPanel = await findByTestId(container, 'left-panel-content');
    const rightPanel = await findByTestId(container, 'right-panel-content');
    const recentSearchedTerms = await findByText(
      container,
      /RecentSearchedTerms/i
    );
    const entityList = await findAllByText(container, /EntityList/i);

    expect(pageLayout).toBeInTheDocument();
    expect(leftPanel).toBeInTheDocument();
    expect(rightPanel).toBeInTheDocument();
    expect(recentSearchedTerms).toBeInTheDocument();
    expect(entityList).toHaveLength(2);
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    const { container } = render(<MyData {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();
  });

  it('Onboarding placeholder should be visible in case of no activity feed present overall and the feeds are not loading', async () => {
    render(<MyData {...mockProp} feedData={[]} />, {
      wrapper: MemoryRouter,
    });

    const activityFeedListContainer = await screen.findByTestId(
      'activityFeedList'
    );

    expect(activityFeedListContainer).toBeInTheDocument();

    const onFeedFiltersUpdate = await screen.findByTestId(
      'onFeedFiltersUpdate'
    );

    expect(onFeedFiltersUpdate).toBeInTheDocument();

    await act(async () => {
      userEvent.click(onFeedFiltersUpdate);
    });

    const activityFeedList = screen.queryByTestId('activityFeedList');

    expect(activityFeedList).toBeNull();

    const onboardingDiv = await screen.findByTestId('Onboarding');

    expect(onboardingDiv).toBeInTheDocument();
  });

  it('Onboarding placeholder should not be visible in case feeds are loading', async () => {
    render(<MyData {...mockProp} isFeedLoading feedData={[]} />, {
      wrapper: MemoryRouter,
    });

    const activityFeedListContainer = await screen.findByTestId(
      'activityFeedList'
    );

    expect(activityFeedListContainer).toBeInTheDocument();

    const onFeedFiltersUpdate = await screen.findByTestId(
      'onFeedFiltersUpdate'
    );

    expect(onFeedFiltersUpdate).toBeInTheDocument();

    await act(async () => {
      userEvent.click(onFeedFiltersUpdate);
    });

    const onboardingDiv = screen.queryByTestId('Onboarding');

    expect(onboardingDiv).toBeNull();
  });
});
