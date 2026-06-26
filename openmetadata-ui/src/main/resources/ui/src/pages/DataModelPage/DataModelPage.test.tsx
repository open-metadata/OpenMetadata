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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
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
  useFqn: jest
    .fn()
    .mockImplementation(() => ({ fqn: 'testFqn', entityFqn: 'testFqn' })),
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

jest.mock('../../utils/EntityDisplayUtils', () => ({
  getEntityMissingError: jest.fn(() => ENTITY_MISSING_ERROR),
}));

jest.mock('../../utils/RecentActivityUtils', () => ({
  addToRecentViewed: jest.fn(),
}));

jest.mock('../../utils/DataModelsUtils', () => ({
  getSortedDataModelColumnTags: jest.fn().mockImplementation((tags) => tags),
}));

jest.mock('../../utils/TablePureUtils', () => {
  return {
    getTierTags: jest.fn().mockImplementation((tags) => tags),
  };
});

jest.mock('../../utils/TagsPureUtils', () => ({
  updateTierTag: () => mockUpdateTierTag(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('fast-json-patch', () => ({
  ...jest.requireActual('fast-json-patch'),
  compare: jest.fn(),
}));

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockImplementation(() => 'testEntityName'),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );

  return render(<DataModelsPage />, { wrapper: Wrapper });
};

describe('DataModelPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDataModelByFqn as jest.Mock).mockResolvedValue({});
    (patchDataModelDetails as jest.Mock).mockResolvedValue({});
    (addDataModelFollower as jest.Mock).mockResolvedValue({});
    (removeDataModelFollower as jest.Mock).mockResolvedValue({});
    (updateDataModelVotes as jest.Mock).mockResolvedValue({});
    mockGetEntityPermissionByFqn.mockResolvedValue({
      ViewAll: true,
      ViewBasic: true,
    });
  });

  it('should render necessary elements', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(getDataModelByFqn).toHaveBeenCalled();
    });

    expect(await screen.findByText('DataModelDetails')).toBeInTheDocument();
  });

  it('toggle delete action check', async () => {
    await act(async () => {
      renderPage();
    });

    fireEvent.click(
      await screen.findByRole('button', {
        name: TOGGLE_DELETE,
      })
    );

    expect(await screen.findByText(DATA_MODEL_DELETED)).toBeInTheDocument();
  });

  it('follow data model action check', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('DataModelDetails')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: FOLLOW_DATA_MODEL }));

    await waitFor(() => expect(addDataModelFollower).toHaveBeenCalled());
  });

  it('unfollow data model action check', async () => {
    (getDataModelByFqn as jest.Mock).mockResolvedValueOnce({
      followers: [
        {
          id: mockUserData.id,
        },
      ],
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('DataModelDetails')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: FOLLOW_DATA_MODEL }));

    await waitFor(() => expect(removeDataModelFollower).toHaveBeenCalled());
  });

  it('update data model action check', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('DataModelDetails')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: UPDATE_DATA_MODEL }));

    await waitFor(() => expect(patchDataModelDetails).toHaveBeenCalledTimes(3));
  });

  it('update vote action check', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('DataModelDetails')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: UPDATE_VOTE }));

    await waitFor(() => expect(updateDataModelVotes).toHaveBeenCalled());
  });

  it('errors check', async () => {
    (patchDataModelDetails as jest.Mock).mockRejectedValue(ERROR);
    (addDataModelFollower as jest.Mock).mockRejectedValue(ERROR);
    (updateDataModelVotes as jest.Mock).mockRejectedValue(ERROR);

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('DataModelDetails')).toBeInTheDocument()
    );

    userEvent.click(screen.getByRole('button', { name: CREATE_THREAD }));

    fireEvent.click(screen.getByRole('button', { name: UPDATE_DATA_MODEL }));

    fireEvent.click(screen.getByRole('button', { name: FOLLOW_DATA_MODEL }));

    fireEvent.click(screen.getByRole('button', { name: UPDATE_VOTE }));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });

  it('error when rendering component', async () => {
    mockGetEntityPermissionByFqn.mockRejectedValueOnce(ERROR);

    await act(async () => {
      renderPage();
    });

    expect(await screen.findByText(ERROR_PLACEHOLDER)).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledWith(FETCH_ENTITY_PERMISSION_ERROR);
  });

  it('error while fetching data model data', async () => {
    (getDataModelByFqn as jest.Mock).mockImplementationOnce(() => {
      return Promise.reject({
        response: { status: 404 },
        message: ERROR,
      });
    });

    await act(async () => {
      renderPage();
    });

    expect(useFqn).toHaveBeenCalled();
    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
      ResourceEntity.DASHBOARD_DATA_MODEL,
      'testFqn'
    );
    expect(await screen.findByText(ERROR_PLACEHOLDER)).toBeInTheDocument();
  });
});
