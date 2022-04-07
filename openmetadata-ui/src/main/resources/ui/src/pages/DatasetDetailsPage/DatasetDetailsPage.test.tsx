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
import {
  getAllFeeds,
  getFeedCount,
  postFeedById,
  postThread,
} from '../../axiosAPIs/feedsAPI';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { addLineage, deleteLineageEdge } from '../../axiosAPIs/miscAPI';
import {
  addColumnTestCase,
  addFollower,
  addTableTestCase,
  deleteColumnTestCase,
  deleteTableTestCase,
  getTableDetailsByFQN,
  patchTableDetails,
  removeFollower,
} from '../../axiosAPIs/tableAPI';
import { deletePost, getUpdatedThread } from '../../utils/FeedUtils';
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
        entityLineageHandler,
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
          <button
            data-testid="entityLineageHandler"
            onClick={entityLineageHandler}>
            entityLineageHandler
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
  addColumnTestCase: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: updateTagRes })),
  addFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockFollowRes })),
  addTableTestCase: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: updateTagRes })),
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
  getUpdatedThread: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ id: 'test', posts: [] })),
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
      const entityLineageHandler = await findByTestId(
        container,
        'entityLineageHandler'
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
      expect(entityLineageHandler).toBeInTheDocument();

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
      fireEvent.click(entityLineageHandler);
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

    it('show error if getTableDetailsByFQN resolves with empty response data', async () => {
      (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ data: '' })
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

    it('show error if getTableDetailsByFQN resolves with empty response', async () => {
      (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve()
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

    // getLineageByFQN test
    it('Show error message on fail of getLineageByFQN api with error message', async () => {
      (getLineageByFQN as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      mockUseParams.tab = 'lineage';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const loadNodeHandler = await findByTestId(container, 'loadNodeHandler');

      expect(ContainerText).toBeInTheDocument();
      expect(loadNodeHandler).toBeInTheDocument();

      fireEvent.click(loadNodeHandler);
    });

    it('Show error message on fail of getLineageByFQN api with empty response', async () => {
      (getLineageByFQN as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );
      mockUseParams.tab = 'lineage';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const loadNodeHandler = await findByTestId(container, 'loadNodeHandler');

      expect(ContainerText).toBeInTheDocument();
      expect(loadNodeHandler).toBeInTheDocument();

      fireEvent.click(loadNodeHandler);
    });

    it('Show error message on resolve of getLineageByFQN api without response', async () => {
      (getLineageByFQN as jest.Mock).mockImplementation(() =>
        Promise.resolve()
      );
      mockUseParams.tab = 'lineage';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const loadNodeHandler = await findByTestId(container, 'loadNodeHandler');

      expect(ContainerText).toBeInTheDocument();
      expect(loadNodeHandler).toBeInTheDocument();

      fireEvent.click(loadNodeHandler);
    });

    it('Show error message on resolve of getLineageByFQN api without response data', async () => {
      (getLineageByFQN as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      mockUseParams.tab = 'lineage';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const loadNodeHandler = await findByTestId(container, 'loadNodeHandler');

      expect(ContainerText).toBeInTheDocument();
      expect(loadNodeHandler).toBeInTheDocument();

      fireEvent.click(loadNodeHandler);
    });

    // getAllFeeds api test

    it('Show error message on fail of getAllFeeds api with error message', async () => {
      (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      mockUseParams.tab = 'activity_feed';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });

    it('Show error message on fail of getAllFeeds api with empty response', async () => {
      (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: {} })
      );
      mockUseParams.tab = 'activity_feed';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });

    it('Show error message on resolve of getAllFeeds api without response', async () => {
      (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve()
      );
      mockUseParams.tab = 'activity_feed';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });

    it('Show error message on resolve of getAllFeeds api without response data', async () => {
      (getAllFeeds as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ data: '' })
      );
      mockUseParams.tab = 'activity_feed';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });

    // getFeedCount api test

    it('Show error message on fail of getFeedCount api with error message', async () => {
      (getFeedCount as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      mockUseParams.tab = 'schema';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });

    it('Show error message on fail of getFeedCount api with empty response', async () => {
      (getFeedCount as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: {} })
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

    it('Show error message on resolve of getFeedCount api without response', async () => {
      (getFeedCount as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve()
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

    it('Show error message on resolve of getFeedCount api without response data', async () => {
      (getFeedCount as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ data: '' })
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

    // CTA actions test

    it('Show error message on fail of CTA api with error message', async () => {
      (patchTableDetails as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      (addFollower as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      (removeFollower as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      (deleteLineageEdge as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      (postFeedById as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      (postThread as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      (deleteTableTestCase as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      (deleteColumnTestCase as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );

      mockUseParams.tab = 'schema';
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const postFeedHandler = await findByTestId(container, 'postFeedHandler');
      const followButton = await findByTestId(container, 'follow-button');
      const unfollowButton = await findByTestId(container, 'unfollow-button');
      const tag = await findByTestId(container, 'tag');
      const description = await findByTestId(container, 'description');
      const columnUpdate = await findByTestId(container, 'columnUpdate');
      const addLineageHandler = await findByTestId(
        container,
        'addLineageHandler'
      );
      const removeLineageHandler = await findByTestId(
        container,
        'removeLineageHandler'
      );
      const createThread = await findByTestId(container, 'createThread');
      const handleRemoveTableTest = await findByTestId(
        container,
        'handleRemoveTableTest'
      );
      const handleRemoveColumnTest = await findByTestId(
        container,
        'handleRemoveColumnTest'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(postFeedHandler).toBeInTheDocument();
      expect(addLineageHandler).toBeInTheDocument();
      expect(removeLineageHandler).toBeInTheDocument();
      expect(followButton).toBeInTheDocument();
      expect(unfollowButton).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(tag).toBeInTheDocument();
      expect(columnUpdate).toBeInTheDocument();
      expect(createThread).toBeInTheDocument();
      expect(handleRemoveTableTest).toBeInTheDocument();
      expect(handleRemoveColumnTest).toBeInTheDocument();

      fireEvent.click(followButton);
      fireEvent.click(postFeedHandler);
      fireEvent.click(unfollowButton);
      fireEvent.click(tag);
      fireEvent.click(columnUpdate);
      fireEvent.click(description);
      fireEvent.click(addLineageHandler);
      fireEvent.click(removeLineageHandler);
      fireEvent.click(createThread);
      fireEvent.click(handleRemoveTableTest);
      fireEvent.click(handleRemoveColumnTest);
    });

    it('Show error message on fail of CTA api with empty response', async () => {
      (patchTableDetails as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );
      (addFollower as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );
      (removeFollower as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );
      (deleteLineageEdge as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );
      (postFeedById as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );
      (postThread as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );
      (deleteTableTestCase as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );
      (deleteColumnTestCase as jest.Mock).mockImplementation(() =>
        Promise.reject({ response: {} })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const postFeedHandler = await findByTestId(container, 'postFeedHandler');
      const followButton = await findByTestId(container, 'follow-button');
      const unfollowButton = await findByTestId(container, 'unfollow-button');
      const tag = await findByTestId(container, 'tag');
      const description = await findByTestId(container, 'description');
      const columnUpdate = await findByTestId(container, 'columnUpdate');
      const addLineageHandler = await findByTestId(
        container,
        'addLineageHandler'
      );
      const removeLineageHandler = await findByTestId(
        container,
        'removeLineageHandler'
      );
      const createThread = await findByTestId(container, 'createThread');
      const handleRemoveTableTest = await findByTestId(
        container,
        'handleRemoveTableTest'
      );
      const handleRemoveColumnTest = await findByTestId(
        container,
        'handleRemoveColumnTest'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(postFeedHandler).toBeInTheDocument();
      expect(addLineageHandler).toBeInTheDocument();
      expect(removeLineageHandler).toBeInTheDocument();
      expect(followButton).toBeInTheDocument();
      expect(unfollowButton).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(tag).toBeInTheDocument();
      expect(columnUpdate).toBeInTheDocument();
      expect(createThread).toBeInTheDocument();
      expect(handleRemoveTableTest).toBeInTheDocument();
      expect(handleRemoveColumnTest).toBeInTheDocument();

      fireEvent.click(followButton);
      fireEvent.click(unfollowButton);
      fireEvent.click(tag);
      fireEvent.click(columnUpdate);
      fireEvent.click(description);
      fireEvent.click(addLineageHandler);
      fireEvent.click(postFeedHandler);
      fireEvent.click(removeLineageHandler);
      fireEvent.click(createThread);
      fireEvent.click(handleRemoveTableTest);
      fireEvent.click(handleRemoveColumnTest);
    });

    it('Show error message on fail of CTA api with empty object', async () => {
      (patchTableDetails as jest.Mock).mockImplementation(() =>
        Promise.reject({})
      );
      (addFollower as jest.Mock).mockImplementation(() => Promise.reject({}));
      (removeFollower as jest.Mock).mockImplementation(() =>
        Promise.reject({})
      );
      (deleteLineageEdge as jest.Mock).mockImplementation(() =>
        Promise.reject({})
      );
      (postFeedById as jest.Mock).mockImplementation(() => Promise.reject({}));
      (postThread as jest.Mock).mockImplementation(() => Promise.reject({}));
      (deleteTableTestCase as jest.Mock).mockImplementation(() =>
        Promise.reject({})
      );
      (deleteColumnTestCase as jest.Mock).mockImplementation(() =>
        Promise.reject({})
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const postFeedHandler = await findByTestId(container, 'postFeedHandler');
      const followButton = await findByTestId(container, 'follow-button');
      const unfollowButton = await findByTestId(container, 'unfollow-button');
      const tag = await findByTestId(container, 'tag');
      const description = await findByTestId(container, 'description');
      const columnUpdate = await findByTestId(container, 'columnUpdate');
      const addLineageHandler = await findByTestId(
        container,
        'addLineageHandler'
      );
      const removeLineageHandler = await findByTestId(
        container,
        'removeLineageHandler'
      );
      const createThread = await findByTestId(container, 'createThread');
      const handleRemoveTableTest = await findByTestId(
        container,
        'handleRemoveTableTest'
      );
      const handleRemoveColumnTest = await findByTestId(
        container,
        'handleRemoveColumnTest'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(postFeedHandler).toBeInTheDocument();
      expect(addLineageHandler).toBeInTheDocument();
      expect(removeLineageHandler).toBeInTheDocument();
      expect(followButton).toBeInTheDocument();
      expect(unfollowButton).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(tag).toBeInTheDocument();
      expect(columnUpdate).toBeInTheDocument();
      expect(createThread).toBeInTheDocument();
      expect(handleRemoveTableTest).toBeInTheDocument();
      expect(handleRemoveColumnTest).toBeInTheDocument();

      fireEvent.click(followButton);
      fireEvent.click(unfollowButton);
      fireEvent.click(tag);
      fireEvent.click(columnUpdate);
      fireEvent.click(description);
      fireEvent.click(addLineageHandler);
      fireEvent.click(postFeedHandler);
      fireEvent.click(removeLineageHandler);
      fireEvent.click(createThread);
      fireEvent.click(handleRemoveTableTest);
      fireEvent.click(handleRemoveColumnTest);
    });

    it('Show error message on resolve of CTA api without response', async () => {
      (patchTableDetails as jest.Mock).mockImplementation(() =>
        Promise.resolve()
      );
      (addFollower as jest.Mock).mockImplementation(() => Promise.resolve());
      (removeFollower as jest.Mock).mockImplementation(() => Promise.resolve());
      (addLineage as jest.Mock).mockImplementation(() => Promise.resolve());
      (deleteLineageEdge as jest.Mock).mockImplementation(() =>
        Promise.resolve()
      );
      (postFeedById as jest.Mock).mockImplementation(() => Promise.resolve());
      (postThread as jest.Mock).mockImplementation(() => Promise.resolve());

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const followButton = await findByTestId(container, 'follow-button');
      const unfollowButton = await findByTestId(container, 'unfollow-button');
      const tag = await findByTestId(container, 'tag');
      const description = await findByTestId(container, 'description');
      const columnUpdate = await findByTestId(container, 'columnUpdate');
      const addLineageHandler = await findByTestId(
        container,
        'addLineageHandler'
      );
      const removeLineageHandler = await findByTestId(
        container,
        'removeLineageHandler'
      );
      const postFeedHandler = await findByTestId(container, 'postFeedHandler');
      const createThread = await findByTestId(container, 'createThread');

      expect(ContainerText).toBeInTheDocument();
      expect(addLineageHandler).toBeInTheDocument();
      expect(removeLineageHandler).toBeInTheDocument();
      expect(followButton).toBeInTheDocument();
      expect(unfollowButton).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(tag).toBeInTheDocument();
      expect(columnUpdate).toBeInTheDocument();
      expect(postFeedHandler).toBeInTheDocument();
      expect(createThread).toBeInTheDocument();

      fireEvent.click(followButton);
      fireEvent.click(unfollowButton);
      fireEvent.click(tag);
      fireEvent.click(columnUpdate);
      fireEvent.click(description);
      fireEvent.click(addLineageHandler);
      fireEvent.click(postFeedHandler);
      fireEvent.click(removeLineageHandler);
      fireEvent.click(createThread);
    });

    it('Show error message on resolve of CTA api without response data', async () => {
      (patchTableDetails as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      (addFollower as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      (removeFollower as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      (addLineage as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      (deleteLineageEdge as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      (postFeedById as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      (postThread as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const followButton = await findByTestId(container, 'follow-button');
      const unfollowButton = await findByTestId(container, 'unfollow-button');
      const tag = await findByTestId(container, 'tag');
      const description = await findByTestId(container, 'description');
      const columnUpdate = await findByTestId(container, 'columnUpdate');
      const addLineageHandler = await findByTestId(
        container,
        'addLineageHandler'
      );
      const removeLineageHandler = await findByTestId(
        container,
        'removeLineageHandler'
      );
      const postFeedHandler = await findByTestId(container, 'postFeedHandler');
      const createThread = await findByTestId(container, 'createThread');

      expect(ContainerText).toBeInTheDocument();
      expect(addLineageHandler).toBeInTheDocument();
      expect(removeLineageHandler).toBeInTheDocument();
      expect(followButton).toBeInTheDocument();
      expect(unfollowButton).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(tag).toBeInTheDocument();
      expect(columnUpdate).toBeInTheDocument();
      expect(postFeedHandler).toBeInTheDocument();
      expect(createThread).toBeInTheDocument();

      fireEvent.click(followButton);
      fireEvent.click(unfollowButton);
      fireEvent.click(tag);
      fireEvent.click(columnUpdate);
      fireEvent.click(description);
      fireEvent.click(addLineageHandler);
      fireEvent.click(removeLineageHandler);
      fireEvent.click(postFeedHandler);
      fireEvent.click(createThread);
    });

    // deletePost api test

    it('Show error message on fail of deletePost api with error message', async () => {
      (deletePost as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    it('Show error message on fail of deletePost api with empty response', async () => {
      (deletePost as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: {} })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    it('Show error message on fail of deletePost api with empty object', async () => {
      (deletePost as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({})
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    it('Show error message on fail of deletePost api with no response', async () => {
      (deletePost as jest.Mock).mockImplementationOnce(() => Promise.reject());

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    // getUpdatedThread api test

    it('Show error message on fail of getUpdatedThread api with error message', async () => {
      (deletePost as jest.Mock).mockImplementationOnce(() => Promise.resolve());
      (getUpdatedThread as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    it('Show error message on fail of getUpdatedThread api with empty response', async () => {
      (getUpdatedThread as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: {} })
      );
      (deletePost as jest.Mock).mockImplementationOnce(() => Promise.resolve());

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    it('Show error message on fail of getUpdatedThread api with empty object', async () => {
      (getUpdatedThread as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({})
      );
      (deletePost as jest.Mock).mockImplementationOnce(() => Promise.resolve());

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    it('Show error message on fail of getUpdatedThread api with no response', async () => {
      (getUpdatedThread as jest.Mock).mockImplementationOnce(() =>
        Promise.reject()
      );
      (deletePost as jest.Mock).mockImplementationOnce(() => Promise.resolve());

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    it('Show error message on resolve of getUpdatedThread api without response data', async () => {
      (getUpdatedThread as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve()
      );
      (deletePost as jest.Mock).mockImplementationOnce(() => Promise.resolve());

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const deletePostHandler = await findByTestId(
        container,
        'deletePostHandler'
      );

      expect(ContainerText).toBeInTheDocument();
      expect(deletePostHandler).toBeInTheDocument();

      fireEvent.click(deletePostHandler);
    });

    // addTableTestCase api test

    it('Show error message on fail of addTableTestCase api with error message', async () => {
      (addTableTestCase as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const addTableTest = await findByTestId(container, 'add-table-test');

      expect(ContainerText).toBeInTheDocument();
      expect(addTableTest).toBeInTheDocument();

      fireEvent.click(addTableTest);
    });

    it('Show error message on fail of addTableTestCase api with empty response', async () => {
      (addTableTestCase as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: {} })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const addTableTest = await findByTestId(container, 'add-table-test');

      expect(ContainerText).toBeInTheDocument();
      expect(addTableTest).toBeInTheDocument();

      fireEvent.click(addTableTest);
    });

    it('Show error message on resolve of addTableTestCase api without response', async () => {
      (addTableTestCase as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve()
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const addTableTest = await findByTestId(container, 'add-table-test');

      expect(ContainerText).toBeInTheDocument();
      expect(addTableTest).toBeInTheDocument();

      fireEvent.click(addTableTest);
    });

    it('Show error message on resolve of addTableTestCase api without response data', async () => {
      (addTableTestCase as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ data: '' })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const addTableTest = await findByTestId(container, 'add-table-test');

      expect(ContainerText).toBeInTheDocument();
      expect(addTableTest).toBeInTheDocument();

      fireEvent.click(addTableTest);
    });

    // addColumnTestCase api test

    it('Show error message on fail of addColumnTestCase api with error message', async () => {
      (addColumnTestCase as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { data: { message: 'Error!' } } })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const addColumnTest = await findByTestId(container, 'add-column-test');

      expect(ContainerText).toBeInTheDocument();
      expect(addColumnTest).toBeInTheDocument();

      fireEvent.click(addColumnTest);
    });

    it('Show error message on fail of addColumnTestCase api with empty response', async () => {
      (addColumnTestCase as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: {} })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const addColumnTest = await findByTestId(container, 'add-column-test');

      expect(ContainerText).toBeInTheDocument();
      expect(addColumnTest).toBeInTheDocument();

      fireEvent.click(addColumnTest);
    });

    it('Show error message on resolve of addColumnTestCase api without response', async () => {
      (addColumnTestCase as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve()
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const addColumnTest = await findByTestId(container, 'add-column-test');

      expect(ContainerText).toBeInTheDocument();
      expect(addColumnTest).toBeInTheDocument();

      fireEvent.click(addColumnTest);
    });

    it('Show error message on resolve of addColumnTestCase api without response data', async () => {
      (addColumnTestCase as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ data: '' })
      );

      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );
      const addColumnTest = await findByTestId(container, 'add-column-test');

      expect(ContainerText).toBeInTheDocument();
      expect(addColumnTest).toBeInTheDocument();

      fireEvent.click(addColumnTest);
    });
  });
});
