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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import React from 'react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { getDatabaseSchemaDetailsByFQN } from 'rest/databaseAPI';
import DatabaseSchemaPageComponent from './DatabaseSchemaPage.component';
import {
  mockEntityPermissions,
  mockGetAllFeedsData,
  mockGetDatabaseSchemaDetailsByFQNData,
  mockGetFeedCountData,
  mockPatchDatabaseSchemaDetailsData,
  mockPostFeedByIdData,
  mockPostThreadData,
  mockSearchQueryData,
} from './mocks/DatabaseSchemaPage.mock';

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="Loader">Loader</div>)
);

jest.mock('components/containers/PageContainerV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="PageContainer">{children}</div>
    ))
);

jest.mock('components/common/title-breadcrumb/title-breadcrumb.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="TitleBreadcrumb">titleBreadcrumb</div>
    ))
);

jest.mock('components/common/TabsPane/TabsPane', () =>
  jest.fn().mockImplementation(() => <div data-testid="TabsPane">TabsPane</div>)
);

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="RichTextEditorPreviewer">RichTextEditorPreviewer</div>
    ))
);

jest.mock('components/common/next-previous/NextPrevious', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="NextPrevious">NextPrevious</div>
    ))
);

jest.mock('components/common/error-with-placeholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="ErrorPlaceHolder">{children}</div>
    ))
);
jest.mock('components/common/EntitySummaryDetails/EntitySummaryDetails', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="EntitySummaryDetails">EntitySummaryDetails</div>
    ))
);

jest.mock('components/common/entityPageInfo/ManageButton/ManageButton', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="ManageButton">ManageButton</div>
    ))
);

jest.mock('components/common/description/Description', () =>
  jest
    .fn()
    .mockImplementation(
      ({ onThreadLinkSelect, onDescriptionEdit, onDescriptionUpdate }) => (
        <div
          data-testid="Description"
          onClick={() => {
            onThreadLinkSelect('threadLink');
            onDescriptionEdit();
            onDescriptionUpdate('Updated Description');
          }}>
          Description
        </div>
      )
    )
);

jest.mock(
  'components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="ActivityThreadPanel">ActivityThreadPanel</div>
      ))
);

jest.mock('components/ActivityFeed/ActivityFeedList/ActivityFeedList', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="ActivityFeedList">ActivityFeedList</div>
    ))
);

jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => Promise.resolve(mockEntityPermissions)),
  })),
}));

jest.mock('rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockSearchQueryData)),
}));

jest.mock('rest/feedsAPI', () => ({
  getAllFeeds: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockGetAllFeedsData)),
  getFeedCount: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockGetFeedCountData)),
  postFeedById: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockPostFeedByIdData)),
  postThread: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockPostThreadData)),
}));

jest.mock('rest/databaseAPI', () => ({
  getDatabaseSchemaDetailsByFQN: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(mockGetDatabaseSchemaDetailsByFQNData)
    ),
  patchDatabaseSchemaDetails: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(mockPatchDatabaseSchemaDetailsData)
    ),
}));

jest.mock('../../AppState', () => ({
  inPageSearchText: '',
}));

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="link">{children}</div>
    )),
  useHistory: jest.fn().mockImplementation(() => ({
    history: {
      push: jest.fn(),
    },
  })),
  useParams: jest.fn().mockImplementation(() => ({
    databaseSchemaFQN: 'sample_data.ecommerce_db.shopify',
    tab: 'tables',
  })),
}));

describe('Tests for DatabaseSchemaPage', () => {
  it('Page should render properly for "Tables" tab', async () => {
    act(() => {
      render(<DatabaseSchemaPageComponent />, {
        wrapper: MemoryRouter,
      });
    });

    const pageContainer = await screen.findByTestId('PageContainer');
    const titleBreadcrumb = await screen.findByTestId('TitleBreadcrumb');
    const tabsPane = await screen.findByTestId('TabsPane');
    const richTextEditorPreviewer = await screen.findAllByTestId(
      'RichTextEditorPreviewer'
    );
    const entitySummaryDetails = await screen.findByTestId(
      'EntitySummaryDetails'
    );
    const manageButton = await screen.findByTestId('ManageButton');
    const description = await screen.findByTestId('Description');
    const nextPrevious = await screen.findByTestId('NextPrevious');
    const databaseSchemaTable = await screen.findByTestId(
      'databaseSchema-tables'
    );

    expect(pageContainer).toBeInTheDocument();
    expect(titleBreadcrumb).toBeInTheDocument();
    expect(tabsPane).toBeInTheDocument();
    expect(richTextEditorPreviewer).toHaveLength(10);
    expect(entitySummaryDetails).toBeInTheDocument();
    expect(manageButton).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(nextPrevious).toBeInTheDocument();
    expect(databaseSchemaTable).toBeInTheDocument();
  });

  it('Activity Feed List should render properly for "Activity Feeds" tab', async () => {
    (useParams as jest.Mock).mockImplementationOnce(() => ({
      databaseSchemaFQN: 'sample_data.ecommerce_db.shopify',
      tab: 'activity_feed',
    }));

    await act(async () => {
      render(<DatabaseSchemaPageComponent />, {
        wrapper: MemoryRouter,
      });
    });

    const activityFeedList = await screen.findByTestId('ActivityFeedList');

    expect(activityFeedList).toBeInTheDocument();
  });

  it('AcivityThreadPanel should render properly after clicked on thread panel button', async () => {
    await act(async () => {
      render(<DatabaseSchemaPageComponent />, {
        wrapper: MemoryRouter,
      });
    });

    const description = await screen.findByTestId('Description');

    expect(description).toBeInTheDocument();

    act(() => {
      fireEvent.click(description);
    });

    const activityThreadPanel = await screen.findByTestId(
      'ActivityThreadPanel'
    );

    expect(activityThreadPanel).toBeInTheDocument();
  });

  it('ErrorPlaceholder should be displayed in case error occurs while fetching database schema details', async () => {
    (getDatabaseSchemaDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject('An error occurred')
    );

    await act(async () => {
      render(<DatabaseSchemaPageComponent />, {
        wrapper: MemoryRouter,
      });
    });

    const errorPlaceHolder = await screen.findByTestId('ErrorPlaceHolder');
    const errorMessage = await screen.findByTestId('error-message');

    expect(errorPlaceHolder).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent('An error occurred');
  });

  it('ErrorPlaceholder should be shown in case of not viewing permissions', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...mockEntityPermissions,
          ViewAll: false,
          ViewBasic: false,
        })
      ),
    }));

    await act(async () => {
      render(<DatabaseSchemaPageComponent />, {
        wrapper: MemoryRouter,
      });
    });

    const errorPlaceHolder = await screen.findByTestId('ErrorPlaceHolder');

    expect(errorPlaceHolder).toBeInTheDocument();
    expect(errorPlaceHolder).toHaveTextContent('message.no-permission-to-view');
  });
});
