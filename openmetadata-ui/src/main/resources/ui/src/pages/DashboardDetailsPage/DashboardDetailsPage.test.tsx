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
import { mockUserData } from '../../components/Settings/Users/mocks/User.mocks';
import DashboardDetailsPage from './DashboardDetailsPage.component';
import {
  CREATE_THREAD,
  DASHBOARD_DELETED,
  ENTITY_MISSING_ERROR,
  ERROR,
  FETCH_DASHBOARD,
  FOLLOW_DASHBOARD,
  TOGGLE_DELETE,
  UNFOLLOW_DASHBOARD,
  UPDATE_CHART_DESCRIPTION,
  UPDATE_CHART_TAGS,
  UPDATE_DASHBOARD,
  UPDATE_VOTE,
  VERSION_HANDLER,
} from './mocks/DashboardDetailsPage.mock';

const mockAddFollower = jest.fn().mockResolvedValue({});
const mockGetDashboardByFqn = jest.fn().mockResolvedValue({ version: 1 });
const mockPatchDashboardDetails = jest.fn().mockResolvedValue({});
const mockRemoveFollower = jest.fn().mockResolvedValue({});
const mockUpdateDashboardVotes = jest.fn().mockResolvedValue({});
const mockUpdateChart = jest.fn().mockResolvedValue({});
const mockPostThread = jest.fn().mockResolvedValue({});
const mockFetchCharts = jest.fn().mockResolvedValue([]);
const mockPush = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(() => ({
    push: mockPush,
  })),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({ currentUser: mockUserData })),
}));

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock(
  '../../components/Dashboard/DashboardDetails/DashboardDetails.component',
  () =>
    jest
      .fn()
      .mockImplementation(
        ({
          dashboardDetails,
          createThread,
          chartDescriptionUpdateHandler,
          chartTagUpdateHandler,
          fetchDashboard,
          followDashboardHandler,
          handleToggleDelete,
          unFollowDashboardHandler,
          versionHandler,
          onDashboardUpdate,
          onUpdateVote,
        }) => (
          <div>
            DashboardDetailsComponent
            <span>{dashboardDetails.deleted ? DASHBOARD_DELETED : ''}</span>
            <button onClick={createThread}>{CREATE_THREAD}</button>
            <button onClick={chartDescriptionUpdateHandler}>
              {UPDATE_CHART_DESCRIPTION}
            </button>
            <button onClick={chartTagUpdateHandler}>{UPDATE_CHART_TAGS}</button>
            <button onClick={fetchDashboard}>{FETCH_DASHBOARD}</button>
            <button onClick={followDashboardHandler}>{FOLLOW_DASHBOARD}</button>
            <button onClick={handleToggleDelete}>{TOGGLE_DELETE}</button>
            <button onClick={unFollowDashboardHandler}>
              {UNFOLLOW_DASHBOARD}
            </button>
            <button onClick={versionHandler}>{VERSION_HANDLER}</button>
            <button onClick={onDashboardUpdate}>{UPDATE_DASHBOARD}</button>
            <button onClick={onUpdateVote}>{UPDATE_VOTE}</button>
          </div>
        )
      )
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
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
  updateChart: jest.fn(() => mockUpdateChart()),
}));

jest.mock('../../rest/dashboardAPI', () => ({
  addFollower: jest.fn(() => mockAddFollower()),
  patchDashboardDetails: jest.fn(() => mockPatchDashboardDetails()),
  removeFollower: jest.fn(() => mockRemoveFollower()),
  updateDashboardVotes: jest.fn(() => mockUpdateDashboardVotes()),
  getDashboardByFqn: jest.fn(() => mockGetDashboardByFqn()),
}));

jest.mock('../../rest/feedsAPI', () => ({
  postThread: jest.fn(() => mockPostThread()),
}));

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getEntityMissingError: jest.fn(() => ENTITY_MISSING_ERROR),
  sortTagsCaseInsensitive: jest.fn((tags) => tags),
}));

jest.mock('../../utils/DashboardDetailsUtils', () => ({
  defaultFields: 'defaultFields',
  fetchCharts: jest.fn(() => mockFetchCharts()),
  sortTagsForCharts: jest.fn((charts) => charts),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(() => mockShowErrorToast()),
}));

jest.mock('fast-json-patch', () => ({
  ...jest.requireActual('fast-json-patch'),
  compare: jest.fn(),
}));

describe('Test DashboardDetails page', () => {
  it('should render Dashboard Details Component after fetching data', async () => {
    render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(screen.getByText('DashboardDetailsComponent')).toBeInTheDocument();
  });

  it('follow and unfollow dashboard action check', async () => {
    render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // follow dashboard
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: FOLLOW_DASHBOARD,
        })
      );
    });

    expect(mockAddFollower).toHaveBeenCalled();

    // unfollow dashboard
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: UNFOLLOW_DASHBOARD,
        })
      );
    });

    expect(mockRemoveFollower).toHaveBeenCalled();
  });

  it('update chart actions check', async () => {
    render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

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
  });

  it('create thread and version handler action check', async () => {
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

    // version handler
    userEvent.click(
      screen.getByRole('button', {
        name: VERSION_HANDLER,
      })
    );

    expect(mockPush).toHaveBeenCalled();
  });

  it('update vote and check toggle delete action', async () => {
    render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // toggle delete
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: TOGGLE_DELETE,
        })
      );
    });

    expect(screen.getByText(DASHBOARD_DELETED)).toBeInTheDocument();

    // update vote
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_VOTE,
        })
      );
    });

    expect(mockUpdateDashboardVotes).toHaveBeenCalled();
  });

  it('fetch and update dashboard action check', async () => {
    render(<DashboardDetailsPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // fetchDashboardDetails
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: FETCH_DASHBOARD,
        })
      );
    });
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(mockGetDashboardByFqn).toHaveBeenCalledTimes(2);
    expect(mockFetchCharts).toHaveBeenCalledTimes(2);

    // update dashboard
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_DASHBOARD,
        })
      );
    });

    expect(mockPatchDashboardDetails).toHaveBeenCalled();
  });

  it('error checks', async () => {
    mockUpdateChart.mockRejectedValue(ERROR);
    mockPostThread.mockRejectedValueOnce(ERROR);
    mockGetDashboardByFqn.mockRejectedValueOnce(ERROR);
    mockFetchCharts.mockRejectedValueOnce(ERROR);
    mockAddFollower.mockRejectedValueOnce(ERROR);
    mockRemoveFollower.mockRejectedValueOnce(ERROR);
    mockPatchDashboardDetails.mockRejectedValueOnce(ERROR);
    mockUpdateDashboardVotes.mockRejectedValueOnce(ERROR);

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

      // follow dashboard
      userEvent.click(
        screen.getByRole('button', {
          name: FOLLOW_DASHBOARD,
        })
      );

      // unfollow dashboard
      userEvent.click(
        screen.getByRole('button', {
          name: UNFOLLOW_DASHBOARD,
        })
      );

      // update dashboard
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_DASHBOARD,
        })
      );

      // update vote
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_VOTE,
        })
      );
    });

    expect(mockShowErrorToast).toHaveBeenCalledTimes(9);

    mockUpdateChart.mockResolvedValue({});
  });
});
