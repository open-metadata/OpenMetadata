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
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { getTableDetailsByFQN } from '../../axiosAPIs/tableAPI';
import DatasetDetailsPage from './DatasetDetailsPage.component';
import {
  createPostRes,
  mockFollowRes,
  mockLineageRes,
  mockUnfollowRes,
  updateTagRes,
} from './datasetDetailsPage.mock';

const mockUseParams = {
  datasetFQN: 'bigquery_gcp:shopify:dim_address',
  tab: 'schema',
};

const mockUseHistory = {
  push: jest.fn(),
};

jest.mock('../../AppState', () => ({
  userDetails: {
    name: 'test',
  },
  users: [
    {
      name: 'test',
    },
  ],
}));

jest.mock('../../components/DatasetDetails/DatasetDetails.component', () => {
  return jest
    .fn()
    .mockImplementation(
      ({
        versionHandler,
        followTableHandler,
        unfollowTableHandler,
        tagUpdateHandler,
        descriptionUpdateHandler,
        columnsUpdateHandler,
        createThread,
        handleAddTableTestCase,
        handleAddColumnTestCase,
        handleTestModeChange,
        handleShowTestForm,
        handleSelectedColumn,
        setActiveTabHandler,
        qualityTestFormHandler,
        settingsUpdateHandler,
        loadNodeHandler,
        addLineageHandler,
        removeLineageHandler,
        postFeedHandler,
        handleRemoveTableTest,
        handleRemoveColumnTest,
        deletePostHandler,
      }) => (
        <div data-testid="datasetdetails-component">
          <button data-testid="version-button" onClick={versionHandler}>
            version
          </button>
          {/* button's is for testing purpose */}
          <button data-testid="unfollow-button" onClick={unfollowTableHandler}>
            unfollow
          </button>
          <button data-testid="follow-button" onClick={followTableHandler}>
            follow
          </button>
          <button data-testid="tag" onClick={tagUpdateHandler}>
            tags
          </button>
          <button data-testid="description" onClick={descriptionUpdateHandler}>
            edit description
          </button>
          <button data-testid="columnUpdate" onClick={columnsUpdateHandler}>
            edit columnUpdate
          </button>
          <button data-testid="createThread" onClick={createThread}>
            createThread
          </button>
          <button data-testid="test-mode" onClick={handleTestModeChange}>
            enable test mode
          </button>
          <button data-testid="test-form" onClick={handleShowTestForm}>
            show test form
          </button>
          <button data-testid="add-table-test" onClick={handleAddTableTestCase}>
            add table test
          </button>
          <button
            data-testid="add-column-test"
            onClick={handleAddColumnTestCase}>
            add column test
          </button>
          <button
            data-testid="selected-column"
            onClick={() => handleSelectedColumn('test')}>
            select column
          </button>
          <button
            data-testid="change-tab"
            onClick={() => setActiveTabHandler(2)}>
            change tab
          </button>
          <button
            data-testid="qualityTestFormHandler"
            onClick={() => qualityTestFormHandler(6, 'table', 'test')}>
            qualityTestFormHandler
          </button>
          <button
            data-testid="settingsUpdateHandler"
            onClick={settingsUpdateHandler}>
            settingsUpdateHandler
          </button>
          <button data-testid="loadNodeHandler" onClick={loadNodeHandler}>
            loadNodeHandler
          </button>
          <button data-testid="addLineageHandler" onClick={addLineageHandler}>
            addLineageHandler
          </button>
          <button
            data-testid="removeLineageHandler"
            onClick={removeLineageHandler}>
            removeLineageHandler
          </button>
          <button data-testid="postFeedHandler" onClick={postFeedHandler}>
            postFeedHandler
          </button>
          <button
            data-testid="handleRemoveTableTest"
            onClick={handleRemoveTableTest}>
            handleRemoveTableTest
          </button>
          <button
            data-testid="handleRemoveColumnTest"
            onClick={handleRemoveColumnTest}>
            handleRemoveColumnTest
          </button>
          <button data-testid="deletePostHandler" onClick={deletePostHandler}>
            deletePostHandler
          </button>
        </div>
      )
    );
});

jest.mock(
  '../../components/common/error-with-placeholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>);
  }
);

jest.mock('../../hooks/useToastContext', () => {
  return jest.fn().mockImplementation(() => jest.fn());
});

jest.mock('fast-json-patch', () => ({
  compare: jest.fn(),
}));

jest.mock('../../axiosAPIs/tableAPI', () => ({
  addColumnTestCase: jest.fn().mockImplementation(() => Promise.resolve()),
  addFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockFollowRes })),
  addTableTestCase: jest.fn().mockImplementation(() => Promise.resolve()),
  deleteColumnTestCase: jest.fn().mockImplementation(() => Promise.resolve()),
  deleteTableTestCase: jest.fn().mockImplementation(() => Promise.resolve()),
  getTableDetailsByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: updateTagRes,
    })
  ),
  patchTableDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: updateTagRes })),
  removeFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockUnfollowRes })),
}));

jest.mock('../../utils/FeedUtils', () => ({
  deletePost: jest.fn().mockImplementation(() => Promise.resolve()),
  getUpdatedThread: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../axiosAPIs/feedsAPI', () => ({
  getAllFeeds: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: { data: [] } })),
  getFeedCount: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        totalCount: 0,
        counts: 0,
      },
    })
  ),
  postFeedById: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        posts: [],
        id: 'test',
      },
    })
  ),
  postThread: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: createPostRes })),
}));

jest.mock('../../axiosAPIs/lineageAPI', () => ({
  getLineageByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockLineageRes })),
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  addLineage: jest.fn().mockImplementation(() => Promise.resolve()),
  deleteLineageEdge: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => mockUseHistory),
  useParams: jest.fn().mockImplementation(() => mockUseParams),
}));

describe('Test DatasetDetails page', () => {
  it('Component should render properly', async () => {
    const { container } = render(<DatasetDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const ContainerText = await findByTestId(
      container,
      'datasetdetails-component'
    );

    expect(ContainerText).toBeInTheDocument();
  });

  it('all CTA should work and it should call respective function and API', async () => {
    await act(async () => {
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const followButton = await findByTestId(container, 'follow-button');
      const unfollowButton = await findByTestId(container, 'unfollow-button');
      const tag = await findByTestId(container, 'tag');
      const description = await findByTestId(container, 'description');
      const columnUpdate = await findByTestId(container, 'columnUpdate');
      const createThread = await findByTestId(container, 'createThread');
      const testmode = await findByTestId(container, 'test-mode');
      const testForm = await findByTestId(container, 'test-form');
      const addTableTest = await findByTestId(container, 'add-table-test');
      const addColumnTest = await findByTestId(container, 'add-column-test');
      const selectedColumn = await findByTestId(container, 'selected-column');
      const changeTab = await findByTestId(container, 'change-tab');
      const qualityTestFormHandler = await findByTestId(
        container,
        'qualityTestFormHandler'
      );
      const settingsUpdateHandler = await findByTestId(
        container,
        'settingsUpdateHandler'
      );
      const loadNodeHandler = await findByTestId(container, 'loadNodeHandler');
      const addLineageHandler = await findByTestId(
        container,
        'addLineageHandler'
      );
      const removeLineageHandler = await findByTestId(
        container,
        'removeLineageHandler'
      );
      const postFeedHandler = await findByTestId(container, 'postFeedHandler');
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );
      const handleRemoveTableTest = await findByTestId(
        container,
        'handleRemoveTableTest'
      );
      const handleRemoveColumnTest = await findByTestId(
        container,
        'handleRemoveColumnTest'
      );

      expect(followButton).toBeInTheDocument();
      expect(unfollowButton).toBeInTheDocument();
      expect(tag).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(columnUpdate).toBeInTheDocument();
      expect(createThread).toBeInTheDocument();
      expect(testmode).toBeInTheDocument();
      expect(testForm).toBeInTheDocument();
      expect(addTableTest).toBeInTheDocument();
      expect(addColumnTest).toBeInTheDocument();
      expect(selectedColumn).toBeInTheDocument();
      expect(changeTab).toBeInTheDocument();
      expect(qualityTestFormHandler).toBeInTheDocument();
      expect(settingsUpdateHandler).toBeInTheDocument();
      expect(loadNodeHandler).toBeInTheDocument();
      expect(addLineageHandler).toBeInTheDocument();
      expect(removeLineageHandler).toBeInTheDocument();
      expect(postFeedHandler).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();
      expect(handleRemoveTableTest).toBeInTheDocument();
      expect(handleRemoveColumnTest).toBeInTheDocument();

      fireEvent.click(followButton);
      fireEvent.click(unfollowButton);
      fireEvent.click(tag);
      fireEvent.click(description);
      fireEvent.click(columnUpdate);
      fireEvent.click(createThread);
      fireEvent.click(testmode);
      fireEvent.click(testForm);
      fireEvent.click(addTableTest);
      fireEvent.click(addColumnTest);
      fireEvent.click(selectedColumn);
      fireEvent.click(changeTab);
      fireEvent.click(qualityTestFormHandler);
      fireEvent.click(settingsUpdateHandler);
      fireEvent.click(loadNodeHandler);
      fireEvent.click(addLineageHandler);
      fireEvent.click(removeLineageHandler);
      fireEvent.click(postFeedHandler);
      fireEvent.click(deletePostHandler);
      fireEvent.click(handleRemoveTableTest);
      fireEvent.click(handleRemoveColumnTest);
    });
  });

  it('Tab specific Component should render if tab is "sample data"', async () => {
    mockUseParams.tab = 'sample_data';
    const { container } = render(<DatasetDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const ContainerText = await findByTestId(
      container,
      'datasetdetails-component'
    );

    expect(ContainerText).toBeInTheDocument();
  });

  it('Tab specific Component should render if tab is "Lineage"', async () => {
    mockUseParams.tab = 'lineage';
    const { container } = render(<DatasetDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const ContainerText = await findByTestId(
      container,
      'datasetdetails-component'
    );

    expect(ContainerText).toBeInTheDocument();
  });

  it('Tab specific Component should render if tab is "Queries"', async () => {
    mockUseParams.tab = 'table_queries';
    const { container } = render(<DatasetDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const ContainerText = await findByTestId(
      container,
      'datasetdetails-component'
    );

    expect(ContainerText).toBeInTheDocument();
  });

  it('onClick of version controal, it should call history.push function', async () => {
    const { container } = render(<DatasetDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const versionButton = await findByTestId(container, 'version-button');

    expect(versionButton).toBeInTheDocument();

    fireEvent.click(versionButton);

    expect(mockUseHistory.push).toHaveBeenCalledTimes(1);
  });

  describe('Render Sad Paths', () => {
    it('ErrorPlaceholder should be visible if there is error with status code 404', async () => {
      mockUseParams.tab = 'schema';
      (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' }, status: 404 },
        })
      );
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const errorPlaceholder = await findByText(
        container,
        /ErrorPlaceHolder.component/i
      );

      expect(errorPlaceholder).toBeInTheDocument();
    });

    it('ErrorPlaceholder should not visible if status code is other than 404 and message is present', async () => {
      (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });

    it('ErrorPlaceholder should not visible if status code is other than 404 and response message is not present', async () => {
      (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { message: '' } })
      );
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });

    it('Show error message on fail of getLineageByFQN api', async () => {
      (getLineageByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });
  });
});
