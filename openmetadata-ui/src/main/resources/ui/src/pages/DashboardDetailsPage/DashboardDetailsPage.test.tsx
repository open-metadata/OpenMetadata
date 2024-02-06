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
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { mockUserData } from '../../components/Users/mocks/User.mocks';
import { mockUpdateChart } from '../../test/unit/mocks/rests/chartAPI.mock';
import {
  mockAddFollower,
  mockGetDashboardByFqn,
  mockPatchDashboardDetails,
  mockRemoveFollower,
  mockUpdateDashboardVotes,
} from '../../test/unit/mocks/rests/dashboardAPI.mock';
import { mockPostThread } from '../../test/unit/mocks/rests/feedsAPI.mock';
import { mockPush } from '../../test/unit/mocks/utils/common.mock';
import {
  mockAddToRecentViewed,
  mockGetEntityMissingError,
  mockSortTagsCaseInsensitive,
} from '../../test/unit/mocks/utils/CommonUtils.mock';
import {
  mockFetchCharts,
  mockSortTagsForCharts,
} from '../../test/unit/mocks/utils/DashboardDetailsUtils.mock';
import { mockGetEntityName } from '../../test/unit/mocks/utils/EntityUtils.mock';
import { mockShowErrorToast } from '../../test/unit/mocks/utils/ToastUtils.mock';
import DashboardDetailsPage from './DashboardDetailsPage.component';
import {
  CREATE_THREAD,
  ERROR,
  FETCH_DASHBOARD,
  FOLLOW_DASHBOARD,
  UPDATE_CHART_DESCRIPTION,
  UPDATE_CHART_TAGS,
} from './mocks/DashboardDetailsPage.mock';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(() => ({
    push: mockPush,
  })),
}));

jest.mock('../../components/Auth/AuthProviders/AuthProvider', () => ({
  useAuthContext: jest.fn(() => ({ currentUser: mockUserData })),
}));

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/DashboardDetails/DashboardDetails.component', () =>
  jest.fn().mockImplementation(
    ({
      createThread,
      chartDescriptionUpdateHandler,
      chartTagUpdateHandler,
      fetchDashboard,
      followDashboardHandler,
      // handleToggleDelete,
      // unFollowDashboardHandler,
      // updateDashboardDetailsState,
      // versionHandler,
      // onDashboardUpdate,
      // onUpdateVote,
    }) => (
      <div>
        DashboardDetailsComponent
        <button onClick={createThread}>{CREATE_THREAD}</button>
        <button onClick={chartDescriptionUpdateHandler}>
          {UPDATE_CHART_DESCRIPTION}
        </button>
        <button onClick={chartTagUpdateHandler}>{UPDATE_CHART_TAGS}</button>
        <button onClick={fetchDashboard}>{FETCH_DASHBOARD}</button>
        <button onClick={followDashboardHandler}>{FOLLOW_DASHBOARD}</button>
        {/* <button onClick={createThread}>Create Thread</button>
        <button onClick={createThread}>Create Thread</button>
        <button onClick={createThread}>Create Thread</button>
        <button onClick={createThread}>Create Thread</button> */}
      </div>
    )
  )
);

jest.mock('../../components/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
      ViewAll: true,
      ViewBasic: true,
    }),
  }),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'mockFQN' }),
}));

jest.mock('../../rest/chartAPI', () => ({
  updateChart: jest.fn(mockUpdateChart),
}));

jest.mock('../../rest/dashboardAPI', () => ({
  addFollower: jest.fn(mockAddFollower),
  patchDashboardDetails: jest.fn(mockPatchDashboardDetails),
  removeFollower: jest.fn(mockRemoveFollower),
  updateDashboardVotes: jest.fn(mockUpdateDashboardVotes),
  getDashboardByFqn: jest.fn(mockGetDashboardByFqn),
}));

jest.mock('../../rest/feedsAPI', () => ({
  postThread: jest.fn(mockPostThread),
}));

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(mockAddToRecentViewed),
  getEntityMissingError: jest.fn(mockGetEntityMissingError),
  sortTagsCaseInsensitive: jest.fn(mockSortTagsCaseInsensitive),
}));

jest.mock('../../utils/DashboardDetailsUtils', () => ({
  defaultFields: 'defaultFields',
  fetchCharts: jest.fn(mockFetchCharts),
  sortTagsForCharts: jest.fn(mockSortTagsForCharts),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(mockGetEntityName),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(mockShowErrorToast),
}));

describe('Test DashboardDetails page', () => {
  it('should render Dashboard Details Component after fetching data', async () => {
    render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(screen.getByText('DashboardDetailsComponent')).toBeInTheDocument();
  });

  it('actions check', async () => {
    render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // create thread
    userEvent.click(
      screen.getByRole('button', {
        name: CREATE_THREAD,
      })
    );

    expect(mockPostThread).toHaveBeenCalled();

    act(() => {
      // update chart description
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_CHART_DESCRIPTION,
        })
      );

      // update chart tags
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_CHART_TAGS,
        })
      );
    });

    expect(mockUpdateChart).toHaveBeenCalledTimes(2);

    // fetchDashboardDetails
    userEvent.click(
      screen.getByRole('button', {
        name: FETCH_DASHBOARD,
      })
    );
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(mockGetDashboardByFqn).toHaveBeenCalledTimes(2);
    expect(mockAddToRecentViewed).toHaveBeenCalledTimes(2);
    expect(mockFetchCharts).toHaveBeenCalledTimes(2);

    // follow dashboard
    userEvent.click(
      screen.getByRole('button', {
        name: FOLLOW_DASHBOARD,
      })
    );

    expect(mockAddFollower).toHaveBeenCalled();
  });

  it('error checks', async () => {
    mockUpdateChart.mockRejectedValue(ERROR);
    mockPostThread.mockRejectedValueOnce(ERROR);
    mockFetchCharts.mockRejectedValueOnce(ERROR);

    render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // create thread
    userEvent.click(
      screen.getByRole('button', {
        name: CREATE_THREAD,
      })
    );

    await act(async () => {
      // update chart description
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_CHART_DESCRIPTION,
        })
      );

      // update chart tags
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_CHART_TAGS,
        })
      );

      // fetchDashboardDetails
      userEvent.click(
        screen.getByRole('button', {
          name: FETCH_DASHBOARD,
        })
      );
    });

    expect(mockShowErrorToast).toHaveBeenCalledTimes(4);

    mockUpdateChart.mockResolvedValue({});
  });
});
