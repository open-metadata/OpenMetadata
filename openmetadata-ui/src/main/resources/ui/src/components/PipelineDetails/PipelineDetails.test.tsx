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
  findByTestId,
  findByText,
  fireEvent,
  getByText,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  LeafNodes,
  LoadingNodeState,
} from '../EntityLineage/EntityLineage.interface';
import PipelineDetails from './PipelineDetails.component';

/**
 * mock implementation of ResizeObserver
 */
window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const mockUserTeam = [
  {
    description: 'description',
    displayName: 'Cloud_Infra',
    id: 'id1',
    name: 'Cloud_infra',
    type: 'team',
  },
  {
    description: 'description',
    displayName: 'Finance',
    id: 'id2',
    name: 'Finance',
    type: 'team',
  },
];

const mockTasks = [
  {
    name: 'snowflake_task',
    displayName: 'Snowflake Task',
    description: 'Airflow operator to perform ETL on snowflake tables',
    taskUrl:
      'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
    downstreamTasks: ['assert_table_exists'],
    taskType: 'SnowflakeOperator',
  },
  {
    name: 'assert_table_exists',
    displayName: 'Assert Table Exists',
    description: 'Assert if a table exists',
    taskUrl:
      'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
    downstreamTasks: [],
    taskType: 'HiveOperator',
  },
];

const mockTags = [
  {
    tagFQN: 'PII.Sensitive',
    source: 'Tag',
  },
  {
    tagFQN: 'PersonalData.Personal',
    source: 'Tag',
  },
];

const mockTaskUpdateHandler = jest.fn();

const PipelineDetailsProps = {
  pipelineUrl: '',
  serviceType: '',
  users: [],
  pipelineDetails: { tasks: mockTasks } as Pipeline,
  entityLineage: {} as EntityLineage,
  entityName: '',
  activeTab: 1,
  owner: {} as EntityReference,
  description: '',
  tier: {} as TagLabel,
  followers: [],
  pipelineTags: [],
  slashedPipelineName: [],
  taskUpdateHandler: mockTaskUpdateHandler,
  setActiveTabHandler: jest.fn(),
  followPipelineHandler: jest.fn(),
  unfollowPipelineHandler: jest.fn(),
  settingsUpdateHandler: jest.fn(),
  descriptionUpdateHandler: jest.fn(),
  tagUpdateHandler: jest.fn(),
  loadNodeHandler: jest.fn(),
  lineageLeafNodes: {} as LeafNodes,
  isNodeLoading: {} as LoadingNodeState,
  version: '',
  versionHandler: jest.fn(),
  addLineageHandler: jest.fn(),
  removeLineageHandler: jest.fn(),
  entityLineageHandler: jest.fn(),
  entityThread: [],
  isentityThreadLoading: false,
  postFeedHandler: jest.fn(),
  feedCount: 0,
  entityFieldThreadCount: [],
  entityFieldTaskCount: [],
  createThread: jest.fn(),
  pipelineFQN: '',
  deletePostHandler: jest.fn(),
  paging: {} as Paging,
  fetchFeedHandler: jest.fn(),
  pipelineStatus: {},
  isPipelineStatusLoading: false,
  updateThreadHandler: jest.fn(),
  onExtensionUpdate: jest.fn(),
};

const mockObserve = jest.fn();
const mockunObserve = jest.fn();

window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockunObserve,
}));

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});
jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviwer</p>);
});

jest.mock('components/Tag/TagsContainer/tags-container', () => {
  return jest.fn().mockReturnValue(<p>Tag Container</p>);
});

jest.mock('components/Tag/Tags/tags', () => {
  return jest.fn().mockReturnValue(<p>Tags</p>);
});

jest.mock('../EntityLineage/EntityLineage.component', () => {
  return jest.fn().mockReturnValue(<p>EntityLineage</p>);
});

jest.mock('../common/entityPageInfo/EntityPageInfo', () => {
  return jest.fn().mockReturnValue(<p>EntityPageInfo</p>);
});

jest.mock('../FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});

jest.mock('../ActivityFeed/ActivityFeedList/ActivityFeedList.tsx', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedList</p>);
});

jest.mock('../EntityLineage/EntityLineage.component', () => {
  return jest.fn().mockReturnValue(<p data-testid="lineage">Lineage</p>);
});

jest.mock('../TasksDAGView/TasksDAGView', () => {
  return jest.fn().mockReturnValue(<p data-testid="tasks-dag">Tasks DAG</p>);
});

jest.mock('../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCurrentUserId: jest.fn().mockReturnValue('CurrentUserId'),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
  getHtmlForNonAdminAction: jest.fn(),
  getEntityPlaceHolder: jest.fn().mockReturnValue('value'),
  getEntityName: jest.fn().mockReturnValue('entityName'),
  getOwnerValue: jest.fn().mockReturnValue('Owner'),
  getFeedCounts: jest.fn(),
  getCountBadge: jest.fn().mockImplementation((count) => <p>{count}</p>),
}));

jest.mock('../Execution/Execution.component', () => {
  return jest.fn().mockImplementation(() => <p>Executions</p>);
});

jest.mock('../Tag/TagsContainer/tags-container', () =>
  jest.fn().mockImplementation(({ onSelectionChange }) => (
    <div data-testid="tags-container">
      <div
        data-testid="onSelectionChange"
        onClick={() => onSelectionChange(mockTags)}>
        onSelectionChange
      </div>
    </div>
  ))
);

describe('Test PipelineDetails component', () => {
  it('Checks if the PipelineDetails component has all the proper components rendered', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const EntityPageInfo = await findByText(container, /EntityPageInfo/i);
    const description = await findByText(container, /Description Component/i);
    const tasksTab = await findByText(container, 'label.task-plural');
    const activityFeedTab = await findByText(
      container,
      'label.activity-feed-and-task-plural'
    );
    const lineageTab = await findByText(container, 'label.lineage');
    const executionsTab = await findByText(container, 'label.execution-plural');
    const customPropertiesTab = await findByText(
      container,
      'label.custom-property-plural'
    );

    expect(EntityPageInfo).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tasksTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(lineageTab).toBeInTheDocument();
    expect(executionsTab).toBeInTheDocument();
    expect(customPropertiesTab).toBeInTheDocument();
  });

  it('Check if active tab is tasks', async () => {
    render(<PipelineDetails {...PipelineDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const taskDetail = await screen.findByText('label.task-plural');

    expect(taskDetail).toBeInTheDocument();
  });

  it('Should render no tasks data placeholder is tasks list is empty', async () => {
    render(
      <PipelineDetails
        {...PipelineDetailsProps}
        pipelineDetails={{} as Pipeline}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const switchContainer = screen.getByTestId('pipeline-task-switch');

    const dagButton = getByText(switchContainer, 'Dag');

    act(() => {
      fireEvent.click(dagButton);
    });

    expect(await screen.findByTestId('no-tasks-data')).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const activityFeedTab = await findByText(
      container,
      'label.activity-feed-and-task-plural'
    );

    await act(async () => {
      fireEvent.click(activityFeedTab);
    });

    const activityFeedList = await findByText(container, /ActivityFeedList/i);

    expect(activityFeedList).toBeInTheDocument();
  });

  it('should render execution tab', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const activityFeedTab = await findByText(
      container,
      'label.execution-plural'
    );

    await act(async () => {
      fireEvent.click(activityFeedTab);
    });
    const executions = await findByText(container, 'Executions');

    expect(executions).toBeInTheDocument();
  });

  it('Check if active tab is lineage', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const activityFeedTab = await findByText(container, 'label.lineage');

    await act(async () => {
      fireEvent.click(activityFeedTab);
    });
    const lineage = await findByTestId(container, 'lineage');

    expect(lineage).toBeInTheDocument();
  });

  it('Check if active tab is custom properties', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const activityFeedTab = await findByText(
      container,
      'label.custom-property-plural'
    );

    await act(async () => {
      fireEvent.click(activityFeedTab);
    });
    const customProperties = await findByText(
      container,
      'CustomPropertyTable.component'
    );

    expect(customProperties).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const activityFeedTab = await findByText(
      container,
      'label.activity-feed-and-task-plural'
    );

    await act(async () => {
      fireEvent.click(activityFeedTab);
    });

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();
  });

  it('taskUpdateHandler should be called after the tags are added or removed to a task', async () => {
    render(<PipelineDetails {...PipelineDetailsProps} />, {
      wrapper: MemoryRouter,
    });

    const tagsContainer = screen.getAllByTestId('tags-container');

    expect(tagsContainer).toHaveLength(2);

    const onSelectionChange = screen.getAllByTestId('onSelectionChange');

    expect(onSelectionChange).toHaveLength(2);

    await act(async () => userEvent.click(onSelectionChange[0]));

    expect(mockTaskUpdateHandler).toHaveBeenCalledTimes(1);
  });
});
