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
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { mockUserData } from '../../components/Settings/Users/mocks/User.mocks';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { useFqn } from '../../hooks/useFqn';
import {
  addDataModelFollower,
  getDataModelByFqn,
  patchDataModelDetails,
  removeDataModelFollower,
  updateDataModelVotes,
} from '../../rest/dataModelsAPI';
import { showErrorToast } from '../../utils/ToastUtils';
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

const mockGetEntityPermissionByFqn = jest.fn().mockImplementation(() => ({
  ViewAll: true,
  ViewBasic: true,
}));
const mockUpdateTierTag = jest.fn();
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
          handleFollowDataModel,
          handleToggleDelete,
          handleUpdateOwner,
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
                handleUpdateOwner();
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
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
  })),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'testFqn' })),
}));

jest.mock('../../rest/dataModelsAPI', () => ({
  getDataModelByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
  patchDataModelDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  addDataModelFollower: jest.fn().mockImplementation(() => Promise.resolve({})),
  updateDataModelVotes: jest.fn().mockImplementation(() => Promise.resolve({})),
  removeDataModelFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getEntityMissingError: jest.fn(() => ENTITY_MISSING_ERROR),
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
  showErrorToast: jest.fn(),
}));

jest.mock('fast-json-patch', () => ({
  ...jest.requireActual('fast-json-patch'),
  compare: jest.fn(),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation(() => 'testEntityName'),
}));

describe('DataModelPage component', () => {
  it('should render necessary elements', async () => {
    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    expect(getDataModelByFqn).toHaveBeenCalled();
    expect(screen.getByText('DataModelDetails')).toBeInTheDocument();
  });

  it('toggle delete action check', async () => {
    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    // toggle delete
    fireEvent.click(
      screen.getByRole('button', {
        name: TOGGLE_DELETE,
      })
    );

    expect(screen.getByText(DATA_MODEL_DELETED)).toBeInTheDocument();
  });

  it('follow data model action check', async () => {
    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    // follow data model
    fireEvent.click(
      screen.getByRole('button', {
        name: FOLLOW_DATA_MODEL,
      })
    );

    expect(addDataModelFollower).toHaveBeenCalled();
  });

  it('unfollow data model action check', async () => {
    (getDataModelByFqn as jest.Mock).mockResolvedValueOnce({
      followers: [
        {
          id: mockUserData.id,
        },
      ],
    });

    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    // unfollow data model
    fireEvent.click(
      screen.getByRole('button', {
        name: FOLLOW_DATA_MODEL,
      })
    );

    expect(removeDataModelFollower).toHaveBeenCalled();
  });

  it('update data model action check', async () => {
    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    // update data model
    fireEvent.click(
      screen.getByRole('button', {
        name: UPDATE_DATA_MODEL,
      })
    );

    expect(patchDataModelDetails).toHaveBeenCalledTimes(3);
  });

  it('update vote action check', async () => {
    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    // update vote
    fireEvent.click(
      screen.getByRole('button', {
        name: UPDATE_VOTE,
      })
    );

    expect(updateDataModelVotes).toHaveBeenCalled();
  });

  it('errors check', async () => {
    (patchDataModelDetails as jest.Mock).mockRejectedValue(ERROR);
    (addDataModelFollower as jest.Mock).mockRejectedValueOnce(ERROR);
    (updateDataModelVotes as jest.Mock).mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    // create thread
    userEvent.click(
      screen.getByRole('button', {
        name: CREATE_THREAD,
      })
    );

    await act(async () => {
      // update data model
      fireEvent.click(
        screen.getByRole('button', {
          name: UPDATE_DATA_MODEL,
        })
      );

      // follow data model
      fireEvent.click(
        screen.getByRole('button', {
          name: FOLLOW_DATA_MODEL,
        })
      );

      // update vote
      fireEvent.click(
        screen.getByRole('button', {
          name: UPDATE_VOTE,
        })
      );
    });

    expect(showErrorToast).toHaveBeenCalledTimes(5);

    (patchDataModelDetails as jest.Mock).mockResolvedValue({});
  });

  it('error when rendering component', async () => {
    mockGetEntityPermissionByFqn.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    expect(screen.getByText(ERROR_PLACEHOLDER)).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledWith(FETCH_ENTITY_PERMISSION_ERROR);
  });

  it('error while fetching data model data', async () => {
    (getDataModelByFqn as jest.Mock).mockImplementationOnce(() => {
      return Promise.reject(new Error(ERROR));
    });

    await act(async () => {
      render(<DataModelsPage />, { wrapper: MemoryRouter });
    });

    expect(useFqn).toHaveBeenCalled();
    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
      ResourceEntity.DASHBOARD_DATA_MODEL,
      'testFqn'
    );
    expect(screen.getByText(ERROR_PLACEHOLDER)).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ERROR,
      })
    );
  });
});
