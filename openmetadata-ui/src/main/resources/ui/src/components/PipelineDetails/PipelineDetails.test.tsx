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
  findAllByTestId,
  findByTestId,
  findByText,
  fireEvent,
  getByText,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import {
  LeafNodes,
  LoadingNodeState,
} from '../../components/Entity/EntityLineage/EntityLineage.interface';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
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
    sourceUrl:
      'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
    downstreamTasks: ['assert_table_exists'],
    taskType: 'SnowflakeOperator',
  },
  {
    name: 'assert_table_exists',
    displayName: 'Assert Table Exists',
    description: 'Assert if a table exists',
    sourceUrl:
      'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
    downstreamTasks: [],
    taskType: 'HiveOperator',
  },
];

const mockTaskUpdateHandler = jest.fn();

const PipelineDetailsProps = {
  sourceUrl: '',
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
  fetchPipeline: jest.fn(),
  setActiveTabHandler: jest.fn(),
  followPipelineHandler: jest.fn(),
  unFollowPipelineHandler: jest.fn(),
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
  handleToggleDelete: jest.fn(),
  onUpdateVote: jest.fn(),
};

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});
jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviwer</p>);
});

jest.mock('../FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});

jest.mock('../Entity/EntityLineage/EntityLineage.component', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="lineage-details">Lineage</p>);
});

jest.mock('../TasksDAGView/TasksDAGView', () => {
  return jest.fn().mockReturnValue(<p data-testid="tasks-dag">Tasks DAG</p>);
});

jest.mock('../containers/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
  getHtmlForNonAdminAction: jest.fn(),
  getEntityPlaceHolder: jest.fn().mockReturnValue('value'),
  getEntityName: jest.fn().mockReturnValue('entityName'),
  getOwnerValue: jest.fn().mockReturnValue('Owner'),
  getFeedCounts: jest.fn(),
  getCountBadge: jest.fn().mockImplementation((count) => <p>{count}</p>),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getAllTagsList: jest.fn().mockImplementation(() => Promise.resolve([])),
  getTagsHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/GlossaryUtils', () => ({
  getGlossaryTermHierarchy: jest.fn().mockReturnValue([]),
  getGlossaryTermsList: jest.fn().mockImplementation(() => Promise.resolve([])),
}));

jest.mock('../Execution/Execution.component', () => {
  return jest.fn().mockImplementation(() => <p>Executions</p>);
});
jest.mock('../../components/TableTags/TableTags.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="table-tag-container">Table Tag Container</div>
    ))
);

describe.skip('Test PipelineDetails component', () => {
  it('Checks if the PipelineDetails component has all the proper components rendered', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

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
    const tagsContainer = await findAllByTestId(
      container,
      'table-tag-container'
    );

    expect(tasksTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(lineageTab).toBeInTheDocument();
    expect(executionsTab).toBeInTheDocument();
    expect(customPropertiesTab).toBeInTheDocument();
    expect(tagsContainer).toHaveLength(4);
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

    await act(() => {
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
    const lineage = await findByTestId(container, 'lineage-details');

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
});
