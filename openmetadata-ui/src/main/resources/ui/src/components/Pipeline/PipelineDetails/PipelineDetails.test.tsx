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
  findByTestId,
  findByText,
  fireEvent,
  getByText,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { EntityTabs } from '../../../enums/entity.enum';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { Paging } from '../../../generated/type/paging';
import { mockPipelineDetails } from '../../../utils/mocks/PipelineDetailsUtils.mock';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import PipelineDetails from './PipelineDetails.component';
import { PipeLineDetailsProp } from './PipelineDetails.interface';

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

const PipelineDetailsProps: PipeLineDetailsProp = {
  pipelineDetails: { tasks: mockTasks } as Pipeline,
  taskUpdateHandler: mockTaskUpdateHandler,
  fetchPipeline: jest.fn(),
  followPipelineHandler: jest.fn(),
  unFollowPipelineHandler: jest.fn(),
  settingsUpdateHandler: jest.fn(),
  descriptionUpdateHandler: jest.fn(),
  versionHandler: jest.fn(),
  pipelineFQN: '',
  paging: {} as Paging,
  onExtensionUpdate: jest.fn(),
  handleToggleDelete: jest.fn(),
  onUpdateVote: jest.fn(),
  onPipelineUpdate: jest.fn(),
};

jest.mock(
  `../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component`,
  () => ({
    ActivityFeedTab: jest.fn().mockReturnValue(<p>testActivityFeedTab</p>),
  })
);

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockReturnValue(<p>OwnerLabel</p>),
}));

jest.mock('../../Entity/EntityRightPanel/EntityRightPanel', () => {
  return jest.fn().mockReturnValue(<p>EntityRightPanel</p>);
});

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: {
      id: 'testUser',
    },
    selectedPersona: {
      id: 'personaid',
      name: 'persona name',
      description: 'persona description',
      type: 'persona type',
      owner: 'persona owner',
    },
  }),
}));

jest.mock('../Execution/Execution.component', () => {
  return jest.fn().mockImplementation(() => <p>Executions</p>);
});

jest.mock('../../Database/ColumnFilter/ColumnFilter.component', () => {
  return jest.fn().mockImplementation(() => <p>ColumnFilter</p>);
});

jest.mock('../../Database/TableDescription/TableDescription.component', () => {
  return jest.fn().mockImplementation(() => <p>TableDescription</p>);
});

jest.mock(
  '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn().mockReturnValue(<p>testDataAssetsHeader</p>),
  })
);

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockReturnValue(<p>testModalWithMarkdownEditor</p>),
  })
);

jest.mock('../../common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name }) => <p>{name}</p>);
});

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: DEFAULT_ENTITY_PERMISSION,
  }),
}));

jest.mock('../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockReturnValue(<p>DescriptionV1</p>);
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => ({ tab: 'tasks' })),
}));

jest.mock('../../../context/LineageProvider/LineageProvider', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../Lineage/Lineage.component', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="lineage-details">Lineage</p>);
});

jest.mock('../TasksDAGView/TasksDAGView', () => {
  return jest.fn().mockReturnValue(<p data-testid="tasks-dag">Tasks DAG</p>);
});

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../utils/TableTags/TableTags.utils', () => ({
  getAllTags: jest.fn().mockReturnValue([]),
  searchTagInData: jest.fn().mockReturnValue([]),
  getFilterTags: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('testEntityName'),
  getColumnSorter: jest.fn().mockImplementation(() => {
    return () => 1;
  }),
}));

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getFeedCounts: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../utils/TagsUtils', () => ({
  createTagObject: jest.fn().mockReturnValue([]),
  updateTierTag: jest.fn().mockReturnValue([]),
  getTagPlaceholder: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel', () => ({
  ActivityThreadPanel: jest.fn().mockReturnValue(<p>ActivityThreadPanel</p>),
}));

jest.mock('../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((component) => component),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    useActivityFeedProvider: jest.fn().mockReturnValue({
      feedCount: 0,
      entityFieldThreadCount: [],
      entityFieldTaskCount: [],
      createThread: jest.fn(),
      postFeedHandler: jest.fn(),
      deletePostHandler: jest.fn(),
      updateThreadHandler: jest.fn(),
      fetchFeedHandler: jest.fn(),
    }),
  })
);

jest.mock('../../../utils/TableUtils', () => ({
  getTagsWithoutTier: jest.fn().mockReturnValue([]),
  getTierTags: jest.fn().mockReturnValue([]),
  getTableExpandableConfig: jest.fn().mockReturnValue({}),
}));

jest.mock('../Execution/Execution.component', () => {
  return jest.fn().mockImplementation(() => <p>Executions</p>);
});
jest.mock('../../Database/TableTags/TableTags.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="table-tag-container">Table Tag Container</div>
    ))
);

jest.mock('../../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  useGenericContext: jest.fn().mockReturnValue({
    data: mockPipelineDetails,
    permissions: DEFAULT_ENTITY_PERMISSION,
  }),
}));

jest.mock('../../../constants/constants', () => ({
  getEntityDetailsPath: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => {
  return {
    getEntityFeedLink: jest.fn(),
    getEntityName: jest.fn(),
    getColumnSorter: jest.fn(),
  };
});

jest.mock('../../../rest/pipelineAPI', () => ({
  restorePipeline: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue([]),
}));

describe('Test PipelineDetails component', () => {
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

  it.skip('Should render no tasks data placeholder is tasks list is empty', async () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { tasks: [] } as unknown as Pipeline,
      permissions: DEFAULT_ENTITY_PERMISSION,
    });
    render(<PipelineDetails {...PipelineDetailsProps} />, {
      wrapper: MemoryRouter,
    });

    const switchContainer = screen.getByTestId('pipeline-task-switch');

    const dagButton = getByText(switchContainer, 'Dag');

    await act(async () => {
      fireEvent.click(dagButton);
    });

    expect(await screen.findByTestId('no-tasks-data')).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    (useParams as jest.Mock).mockReturnValue({ tab: EntityTabs.ACTIVITY_FEED });

    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const activityFeedList = await findByText(container, 'testActivityFeedTab');

    expect(activityFeedList).toBeInTheDocument();
  });

  it('should render execution tab', async () => {
    (useParams as jest.Mock).mockReturnValue({ tab: EntityTabs.EXECUTIONS });
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const executions = await findByText(container, 'Executions');

    expect(executions).toBeInTheDocument();
  });

  it('Check if active tab is lineage', async () => {
    (useParams as jest.Mock).mockReturnValue({ tab: EntityTabs.LINEAGE });
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const lineage = await findByTestId(container, 'lineage-details');

    expect(lineage).toBeInTheDocument();
  });

  it('Check if active tab is custom properties', async () => {
    (useParams as jest.Mock).mockReturnValue({
      tab: EntityTabs.CUSTOM_PROPERTIES,
    });
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const customProperties = await findByText(
      container,
      'CustomPropertyTable.component'
    );

    expect(customProperties).toBeInTheDocument();
  });
});
