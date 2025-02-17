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

import { ColumnType } from 'antd/lib/table';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { PIPELINE_TASK_TABS } from '../constants/pipeline.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Tag } from '../generated/entity/classification/tag';
import {
  Pipeline,
  PipelineServiceType,
  State,
  StatusType,
  Task,
} from '../generated/entity/data/pipeline';
import { EntityReference } from '../generated/entity/type';
import { Tab } from '../generated/system/ui/uiCustomization';
import { LabelType, TagLabel, TagSource } from '../generated/type/tagLabel';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import {
  getPipelineDetailPageTabs,
  getPipelineWidgetsFromKey,
} from './PipelineDetailsUtils';

export interface PipelineDetailPageTabProps {
  description: string;
  entityName: string;
  feedCount: {
    totalCount: number;
  };
  editDescriptionPermission: boolean;
  editGlossaryTermsPermission: boolean;
  editTagsPermission: boolean;
  getEntityFeedCount: () => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
  handleTagSelection: (selectedTags: TagLabel[]) => Promise<void>;
  onDescriptionUpdate: (value: string) => Promise<void>;
  onExtensionUpdate: (updatedPipeline: Pipeline) => Promise<void>;
  pipelineDetails: Pipeline;
  pipelineFQN: string;
  tasksInternal: Task[];
  tasksDAGView: JSX.Element;
  tags: Tag[];
  viewAllPermission: boolean;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  deleted: boolean;
  activeTab: PIPELINE_TASK_TABS;
  tab: EntityTabs;
  setActiveTab: (tab: PIPELINE_TASK_TABS) => void;
  taskColumns: ColumnType<Task>[];
  owners: EntityReference[];
  fetchPipeline: () => void;
  labelMap?: Record<EntityTabs, string>;
}

class PipelineClassBase {
  public getPipelineDetailPageTabs(
    tabProps: PipelineDetailPageTabProps
  ): TabProps[] {
    return getPipelineDetailPageTabs(tabProps);
  }

  public getPipelineDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.SCHEMA,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.SAMPLE_DATA,
      EntityTabs.TABLE_QUERIES,
      EntityTabs.PROFILER,
      EntityTabs.INCIDENTS,
      EntityTabs.LINEAGE,
      EntityTabs.VIEW_DEFINITION,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: [
        EntityTabs.SCHEMA,
        EntityTabs.OVERVIEW,
        EntityTabs.TERMS,
      ].includes(tab),
    }));
  }

  public getDefaultLayout(tab: EntityTabs) {
    switch (tab) {
      case EntityTabs.TASKS:
        return [
          {
            h: 2,
            i: DetailPageWidgetKeys.DESCRIPTION,
            w: 6,
            x: 0,
            y: 0,
            static: false,
          },
          {
            h: 11,
            i: DetailPageWidgetKeys.PIPELINE_TASKS,
            w: 6,
            x: 0,
            y: 0,
            static: false,
          },
          {
            h: 1,
            i: DetailPageWidgetKeys.DATA_PRODUCTS,
            w: 2,
            x: 6,
            y: 1,
            static: false,
          },
          {
            h: 2,
            i: DetailPageWidgetKeys.TAGS,
            w: 2,
            x: 6,
            y: 2,
            static: false,
          },
          {
            h: 2,
            i: DetailPageWidgetKeys.GLOSSARY_TERMS,
            w: 2,
            x: 6,
            y: 3,
            static: false,
          },
          {
            h: 4,
            i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
            w: 2,
            x: 6,
            y: 6,
            static: false,
          },
        ];

      default:
        return [];
    }
  }

  public getDummyData(): Pipeline {
    return {
      id: '60670fe2-eb0a-41a2-a683-d32964e7e61b',
      name: 'dim_address_etl',
      displayName: 'dim_address etl',
      fullyQualifiedName: 'sample_airflow.dim_address_etl',
      description: 'dim_address ETL pipeline',
      dataProducts: [],
      version: 0.2,
      updatedAt: 1726204840178,
      updatedBy: 'ashish',
      sourceUrl: 'http://localhost:8080/tree?dag_id=dim_address_etl',
      tasks: [
        {
          name: 'dim_address_task',
          displayName: 'dim_address Task',
          fullyQualifiedName: 'sample_airflow.dim_address_etl.dim_address_task',
          description:
            'Airflow operator to perform ETL and generate dim_address table',
          sourceUrl:
            'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=dim_address_task',
          downstreamTasks: ['assert_table_exists'],
          taskType: 'PrestoOperator',
          tags: [
            {
              tagFQN: '"collection.new"."I.have.dots"',
              name: 'I.have.dots',
              displayName: '',
              description: 'asd',
              source: TagSource.Glossary,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
            {
              tagFQN: 'test Classification.test tag 1',
              name: 'test tag 1',
              displayName: '',
              description: 'test tag 1',
              style: {
                color: '#da1010',
                iconURL:
                  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJUAAACUCAMAAACtIJvYAAAAA1BMVEX/AAAZ4gk3AAAALElEQVR4nO3BMQEAAADCoPVP7WkJoAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAGVrgAAQdwvSEAAAAASUVORK5CYII=',
              },
              source: TagSource.Classification,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ],
        },
        {
          name: 'assert_table_exists',
          displayName: 'Assert Table Exists',
          fullyQualifiedName:
            'sample_airflow.dim_address_etl.assert_table_exists',
          description: 'Assert if a table exists',
          sourceUrl:
            'http://localhost:8080/taskinstance/list/?flt1_dag_id_equals=assert_table_exists',
          downstreamTasks: [],
          taskType: 'HiveOperator',
          tags: [],
        },
      ],
      pipelineStatus: {
        timestamp: 1723014798482,
        executionStatus: StatusType.Pending,
        taskStatus: [
          {
            name: 'dim_address_task',
            executionStatus: StatusType.Pending,
          },
          {
            name: 'assert_table_exists',
            executionStatus: StatusType.Pending,
          },
        ],
      },
      followers: [
        {
          id: 'e596a9cd-9ce1-4e12-aee1-b6f31926b0e8',
          type: 'user',
          name: 'ashish',
          fullyQualifiedName: 'ashish',
          description:
            '<p><code>data driven car</code></p><p><code>Hybrid Modal</code></p>',
          displayName: 'Ashish',
          deleted: false,
          href: 'http://test-argo.getcollate.io/api/v1/users/e596a9cd-9ce1-4e12-aee1-b6f31926b0e8',
        },
      ],
      tags: [
        {
          tagFQN: 'Tier.Tier1',
          name: 'Tier1',
          displayName: 'Priority 1',
          description:
            // eslint-disable-next-line max-len
            '**Critical Source of Truth business data assets of an organization**\n\n- Used in critical metrics and dashboards to drive business and product decisions\n\n- Used in critical compliance reporting to regulators, govt entities, and third party\n\n- Used in brand or revenue impacting online user-facing experiences (search results, advertisement, promotions, and experimentation)\n\n- Other high impact use, such as ML models and fraud detection\n\n- Source used to derive other critical Tier-1 datasets',
          style: {},
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
      href: 'http://test-argo.getcollate.io/api/v1/pipelines/60670fe2-eb0a-41a2-a683-d32964e7e61b',
      owners: [],
      service: {
        id: 'f83c2b6e-0d09-4839-98df-5571cc17c829',
        type: 'pipelineService',
        name: 'sample_airflow',
        fullyQualifiedName: 'sample_airflow',
        displayName: 'sample_airflow',
        deleted: false,
        href: 'http://test-argo.getcollate.io/api/v1/services/pipelineServices/f83c2b6e-0d09-4839-98df-5571cc17c829',
      },
      serviceType: PipelineServiceType.Airflow,
      deleted: false,
      scheduleInterval: '5 * * * *',
      domain: {
        id: '6b440596-144b-417b-b7ee-95cf0b0d7de4',
        type: 'domain',
        name: 'Version -1.6.2 Domain',
        fullyQualifiedName: '"Version -1.6.2 Domain"',
        description: '<p>Version -1.6.2 Domain</p>',
        displayName: 'Version -1.6.2 Domain',
        inherited: true,
        href: 'http://test-argo.getcollate.io/api/v1/domains/6b440596-144b-417b-b7ee-95cf0b0d7de4',
      },
      votes: {
        upVotes: 0,
        downVotes: 0,
        upVoters: [],
        downVoters: [],
      },
    };
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.PIPELINE_TASKS,
        name: i18n.t('label.schema'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      DATA_PRODUCTS_WIDGET,
      TAGS_WIDGET,
      GLOSSARY_TERMS_WIDGET,
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getPipelineWidgetsFromKey(widgetConfig);
  }
}

const pipelineClassBase = new PipelineClassBase();

export default pipelineClassBase;
export { PipelineClassBase };
