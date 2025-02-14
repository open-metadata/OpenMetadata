/*
 *  Copyright 2024 Collate.
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
import { mockUserData } from '../../components/Settings/Users/mocks/User.mocks';
import DataModelsPage from './DataModelPage.component';
import {
  CREATE_THREAD,
  DATA_MODEL_DELETED,
  ERROR,
  ERROR_PLACEHOLDER,
  FETCH_ENTITY_PERMISSION_ERROR,
  FOLLOW_DATA_MODEL,
  TOGGLE_DELETE,
  UPDATE_DATA_MODEL,
  UPDATE_VOTE,
} from './mocks/DataModelPage.mock';

const mockAddDataModelFollower = jest.fn().mockResolvedValue({});
const mockGetDataModelByFqn = jest.fn().mockResolvedValue({});
const mockPatchDataModelDetails = jest.fn().mockResolvedValue({});
const mockRemoveDataModelFollower = jest.fn().mockResolvedValue({});
const mockUpdateDataModelVotes = jest.fn().mockResolvedValue({});
const mockGetEntityPermissionByFqn = jest.fn().mockResolvedValue({
  ViewAll: true,
  ViewBasic: true,
});
const mockUpdateTierTag = jest.fn();
const mockShowErrorToast = jest.fn();
const ENTITY_MISSING_ERROR = 'Entity missing error.';

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>{ERROR_PLACEHOLDER}</div>)
);

jest.mock(
  '../../components/Dashboard/DataModel/DataModels/DataModelDetails.component',
  () =>
    jest
      .fn()
      .mockImplementation(
        ({
          createThread,
          dataModelData,
          handleColumnUpdateDataModel,
          handleFollowDataModel,
          handleToggleDelete,
          handleUpdateDescription,
          handleUpdateOwner,
          handleUpdateTags,
          handleUpdateTier,
          onUpdateDataModel,
          onUpdateVote,
        }) => (
          <div>
            DataModelDetails
            <p>{dataModelData.deleted ? DATA_MODEL_DELETED : ''}</p>
            <button onClick={createThread}>{CREATE_THREAD}</button>
            <button
              onClick={() => {
                handleColumnUpdateDataModel();
                handleUpdateDescription();
                handleUpdateOwner();
                handleUpdateTags();
                handleUpdateTier();
                onUpdateDataModel();
              }}>
              {UPDATE_DATA_MODEL}
            </button>
            <button onClick={handleFollowDataModel}>{FOLLOW_DATA_MODEL}</button>
            <button onClick={onUpdateVote}>{UPDATE_VOTE}</button>
            <button onClick={handleToggleDelete}>{TOGGLE_DELETE}</button>
          </div>
        )
      )
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn(() => mockGetEntityPermissionByFqn()),
  }),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'testFqn' })),
}));

jest.mock('../../rest/dataModelsAPI', () => ({
  addDataModelFollower: () => mockAddDataModelFollower(),
  getDataModelByFqn: () => mockGetDataModelByFqn(),
  patchDataModelDetails: () => mockPatchDataModelDetails(),
  removeDataModelFollower: () => mockRemoveDataModelFollower(),
  updateDataModelVotes: () => mockUpdateDataModelVotes(),
}));

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getEntityMissingError: jest.fn(() => ENTITY_MISSING_ERROR),
  sortTagsCaseInsensitive: jest.fn((tags) => tags),
}));

jest.mock('../../utils/DataModelsUtils', () => ({
  getSortedDataModelColumnTags: jest.fn().mockImplementation((tags) => tags),
}));

jest.mock('../../utils/TableUtils', () => {
  return {
    getTierTags: jest.fn().mockImplementation((tags) => tags),
  };
});

jest.mock('../../utils/TagsUtils', () => ({
  updateTierTag: () => mockUpdateTierTag(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((...args) => mockShowErrorToast(...args)),
}));

jest.mock('fast-json-patch', () => ({
  ...jest.requireActual('fast-json-patch'),
  compare: jest.fn(),
}));

describe('DataModelPage component', () => {
  it('should render necessary elements', async () => {
    render(<DataModelsPage />);
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(mockGetDataModelByFqn).toHaveBeenCalled();
    expect(screen.getByText('DataModelDetails')).toBeInTheDocument();
  });

  it('toggle delete action check', async () => {
    render(<DataModelsPage />);
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // toggle delete
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: TOGGLE_DELETE,
        })
      );
    });

    expect(screen.getByText(DATA_MODEL_DELETED)).toBeInTheDocument();
  });

  it('follow data model action check', async () => {
    render(<DataModelsPage />);
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // follow data model
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: FOLLOW_DATA_MODEL,
        })
      );
    });

    expect(mockAddDataModelFollower).toHaveBeenCalled();
  });

  it('unfollow data model action check', async () => {
    mockGetDataModelByFqn.mockResolvedValueOnce({
      followers: [
        {
          id: mockUserData.id,
        },
      ],
    });

    render(<DataModelsPage />);
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // unfollow data model
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: FOLLOW_DATA_MODEL,
        })
      );
    });

    expect(mockRemoveDataModelFollower).toHaveBeenCalled();
  });

  it('update data model action check', async () => {
    render(<DataModelsPage />);
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // update data model
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_DATA_MODEL,
        })
      );
    });

    expect(mockPatchDataModelDetails).toHaveBeenCalledTimes(6);
  });

  it('update vote action check', async () => {
    render(<DataModelsPage />);
    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    // update vote
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_VOTE,
        })
      );
    });

    expect(mockUpdateDataModelVotes).toHaveBeenCalled();
  });

  it('errors check', async () => {
    mockPatchDataModelDetails.mockRejectedValue(ERROR);
    mockAddDataModelFollower.mockRejectedValueOnce(ERROR);
    mockUpdateDataModelVotes.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<DataModelsPage />);
    });

    // create thread
    userEvent.click(
      screen.getByRole('button', {
        name: CREATE_THREAD,
      })
    );

    await act(async () => {
      // update data model
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_DATA_MODEL,
        })
      );

      // follow data model
      userEvent.click(
        screen.getByRole('button', {
          name: FOLLOW_DATA_MODEL,
        })
      );

      // update vote
      userEvent.click(
        screen.getByRole('button', {
          name: UPDATE_VOTE,
        })
      );
    });

    expect(mockShowErrorToast).toHaveBeenCalledTimes(8);

    mockPatchDataModelDetails.mockResolvedValue({});
  });

  it('error when rendering component', async () => {
    mockGetEntityPermissionByFqn.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<DataModelsPage />);
    });

    expect(screen.getByText(ERROR_PLACEHOLDER)).toBeInTheDocument();
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      FETCH_ENTITY_PERMISSION_ERROR
    );
  });

  it('error while fetching data model data', async () => {
    mockGetDataModelByFqn.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<DataModelsPage />);
    });

    expect(screen.getByText(ERROR_PLACEHOLDER)).toBeInTheDocument();
    expect(mockShowErrorToast).toHaveBeenCalledWith(ERROR);
  });
});
