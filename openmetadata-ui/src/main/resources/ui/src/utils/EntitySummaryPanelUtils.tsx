/* eslint-disable no-case-declarations */
/*
 *  Copyright 2023 Collate.
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

import Icon from '@ant-design/icons';
import { Col, Row, Typography } from 'antd';
import { get, isEmpty } from 'lodash';
import { lazy } from 'react';
import { Link } from 'react-router-dom';
import { SearchedDataProps } from '../../src/components/SearchedData/SearchedData.interface';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { GenericProvider } from '../components/Customization/GenericProvider/GenericProvider';
import type { BasicEntityInfo } from '../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
import { ICON_DIMENSION, NO_DATA_PLACEHOLDER } from '../constants/constants';
import { CustomizeEntityType } from '../constants/Customize.constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { CSMode } from '../enums/codemirror.enum';
import { EntityType } from '../enums/entity.enum';
import { SummaryEntityType } from '../enums/EntitySummary.enum';
import type { Tag } from '../generated/entity/classification/tag';
import type { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import type { Chart } from '../generated/entity/data/chart';
import type { Container } from '../generated/entity/data/container';
import type { Dashboard } from '../generated/entity/data/dashboard';
import type { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import type { Database } from '../generated/entity/data/database';
import type { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import type { Metric } from '../generated/entity/data/metric';
import type { MlFeature, Mlmodel } from '../generated/entity/data/mlmodel';
import type { Pipeline, Task } from '../generated/entity/data/pipeline';
import type { SearchIndex } from '../generated/entity/data/searchIndex';
import type {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../generated/entity/data/storedProcedure';
import type {
  Column,
  Table,
  TableConstraint,
} from '../generated/entity/data/table';
import type { Field, Topic } from '../generated/entity/data/topic';
import type { DataProduct } from '../generated/entity/domains/dataProduct';
import type { Domain } from '../generated/entity/domains/domain';
import type { EntityReference } from '../generated/tests/testCase';
import { getEntityName } from './EntityNameUtils';
import {
  getHighlightOfListItem,
  getMapOfListHighlights,
  getSummaryListItemType,
  type ListItemHighlights,
  type SummaryListItem,
} from './EntitySummaryPanelPureUtils';
import entityUtilClassBase from './EntityUtilClassBase';
import { t } from './i18next/LocalUtil';
import searchClassBase from './SearchClassBase';
import { stringToHTML } from './StringUtils';

const APIEndpointSummary = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/Explore/EntitySummaryPanel/APIEndpointSummary/APIEndpointSummary'
      )
  )
);

const ColumnSummaryList = withSuspenseFallback(
  lazy(() =>
    import(
      '../components/Explore/EntitySummaryPanel/ColumnSummaryList/ColumnsSummaryList'
    ).then((m) => ({ default: m.ColumnSummaryList }))
  )
);

const DataProductSummary = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/Explore/EntitySummaryPanel/DataProductSummary/DataProductSummary.component'
      )
  )
);

const DomainSummary = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/Explore/EntitySummaryPanel/DomainSummary/DomainSummary.component'
      )
  )
);

const GlossaryTermSummary = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/Explore/EntitySummaryPanel/GlossaryTermSummary/GlossaryTermSummary.component'
      )
  )
);

const SummaryList = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.component'
      )
  )
);

const TagsSummary = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/Explore/EntitySummaryPanel/TagsSummary/TagsSummary.component'
      )
  )
);

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../components/Database/SchemaEditor/SchemaEditor'))
);

const MetricExpression = withSuspenseFallback(
  lazy(() => import('../components/Metric/MetricExpression/MetricExpression'))
);

const RelatedMetrics = withSuspenseFallback(
  lazy(() => import('../components/Metric/RelatedMetrics/RelatedMetrics'))
);

export {
  getHighlightOfListItem,
  getMapOfListHighlights,
  getSortedTagsWithHighlight,
  getSummaryListItemType,
  toEntityData,
} from './EntitySummaryPanelPureUtils';
export type { ListItemHighlights, SummaryListItem };

const { Text } = Typography;

/*
 * @param {
 *   listItem: SummaryItem,
 *   highlightedTitle: will be a string if the title of given summaryItem is present in highlights | undefined
 * }
 *
 *  @return SummaryItemTitle
 */
export const getTitle = (
  listItem: SummaryListItem,
  highlightedTitle?: ListItemHighlights['highlightedTitle']
): JSX.Element | JSX.Element[] => {
  const title = highlightedTitle
    ? stringToHTML(highlightedTitle)
    : getEntityName(listItem) || NO_DATA_PLACEHOLDER;
  const sourceUrl = (listItem as Chart | Task).sourceUrl;

  if ((listItem as EntityReference).type === SummaryEntityType.DASHBOARD) {
    return (
      <Link
        to={entityUtilClassBase.getEntityLink(
          EntityType.DASHBOARD,
          listItem.fullyQualifiedName ?? ''
        )}>
        <Text
          className="entity-title text-link-color font-medium m-r-xss"
          data-testid="entity-title"
          ellipsis={{ tooltip: true }}>
          {title}
        </Text>
      </Link>
    );
  }

  return sourceUrl ? (
    <Link target="_blank" to={sourceUrl}>
      <div className="d-flex items-center">
        <Text
          className="entity-title text-link-color font-medium m-r-xss"
          data-testid="entity-title"
          ellipsis={{ tooltip: true }}>
          {title}
        </Text>
        <Icon component={IconExternalLink} style={ICON_DIMENSION} />
      </div>
    </Link>
  ) : (
    <Text
      className="entity-title"
      data-testid="entity-title"
      ellipsis={{ tooltip: true }}>
      {title}
    </Text>
  );
};

/*
 *  @params {
 *     entityType: SummaryEntityType,
 *     entityInfo: Array<SummaryListItem> = [],
 *     highlights: highlights get from the query api + highlights added for tags (i.e. tag.name)
 *     tableConstraints: only pass for SummayEntityType.Column
 *  }
 *  @return sorted and highlighted listItem array, but listItem will be type of BasicEntityInfo
 *
 *  Note: SummaryItem will be sort and highlight only if -
 *      # if listItem.tags present in highlights.tags
 *      # if listItem.name present in highlights comes from query api
 *      # if listItem.description present in highlights comes from query api
 */
export const getFormattedEntityData = (
  entityType: SummaryEntityType,
  entityInfo: Array<SummaryListItem> = [],
  highlights?: SearchedDataProps['data'][number]['highlight'],
  tableConstraints?: TableConstraint[]
): BasicEntityInfo[] => {
  if (isEmpty(entityInfo)) {
    return [];
  }

  if (Object.values(SummaryEntityType).includes(entityType)) {
    const tagHighlights = get(highlights, 'tag.name', [] as string[]);

    const { listHighlights, listHighlightsMap } =
      getMapOfListHighlights(highlights);

    const entityHasChildren = [
      SummaryEntityType.COLUMN,
      SummaryEntityType.FIELD,
      SummaryEntityType.SCHEMAFIELD,
    ].includes(entityType);

    const { highlightedListItem, remainingListItem } = entityInfo.reduce(
      (acc, listItem) => {
        const { highlightedTags, highlightedTitle, highlightedDescription } =
          getHighlightOfListItem(
            listItem,
            tagHighlights,
            listHighlights,
            listHighlightsMap
          );

        const listItemModifiedData = {
          name: listItem.name ?? '',
          title: getTitle(listItem, highlightedTitle),
          type: getSummaryListItemType(entityType, listItem),
          tags: highlightedTags ?? listItem.tags,
          description: highlightedDescription ?? listItem.description,
          ...(entityType === SummaryEntityType.COLUMN && {
            columnConstraint: (listItem as Column).constraint,
            tableConstraints: tableConstraints,
          }),
          ...(entityType === SummaryEntityType.MLFEATURE && {
            algorithm: (listItem as MlFeature).featureAlgorithm,
          }),
          ...(entityHasChildren && {
            children: getFormattedEntityData(
              entityType,
              (listItem as Column | Field).children,
              highlights
            ),
          }),
        };

        if (highlightedTags || highlightedTitle || highlightedDescription) {
          acc.highlightedListItem.push(listItemModifiedData);
        } else {
          acc.remainingListItem.push(listItemModifiedData);
        }

        return acc;
      },
      {
        highlightedListItem: [] as BasicEntityInfo[],
        remainingListItem: [] as BasicEntityInfo[],
      }
    );

    return [...highlightedListItem, ...remainingListItem];
  }

  return [];
};

export const getEntityChildDetails = (
  entityType: EntityType,
  entityInfo: SearchedDataProps['data'][number]['_source'],
  highlights?: SearchedDataProps['data'][number]['highlight'],
  loading?: boolean
) => {
  let childComponent;
  let heading;
  let headingTestId = 'schema-header';

  switch (entityType) {
    case EntityType.TABLE:
      heading = t('label.schema');
      childComponent = (
        <ColumnSummaryList
          entityInfo={entityInfo as Table}
          entityType={entityType}
          highlights={highlights}
        />
      );

      break;
    case EntityType.TOPIC:
      heading = t('label.schema');
      childComponent = isEmpty(
        (entityInfo as Topic).messageSchema?.schemaFields
      ) ? (
        <Typography.Text data-testid="no-data-message">
          <Typography.Text className="no-data-chip-placeholder">
            {t('message.no-data-available')}
          </Typography.Text>
        </Typography.Text>
      ) : (
        <SummaryList
          formattedEntityData={getFormattedEntityData(
            SummaryEntityType.SCHEMAFIELD,
            (entityInfo as Topic).messageSchema?.schemaFields,
            highlights
          )}
        />
      );

      break;
    case EntityType.PIPELINE:
      heading = t('label.task-plural');
      headingTestId = 'tasks-header';
      childComponent = (
        <SummaryList
          formattedEntityData={getFormattedEntityData(
            SummaryEntityType.TASK,
            (entityInfo as Pipeline).tasks,
            highlights
          )}
        />
      );

      break;
    case EntityType.DASHBOARD:
      const formattedChartsData: BasicEntityInfo[] = getFormattedEntityData(
        SummaryEntityType.CHART,
        (entityInfo as Dashboard).charts,
        highlights
      );

      const formattedDataModelData: BasicEntityInfo[] = getFormattedEntityData(
        SummaryEntityType.COLUMN,
        (entityInfo as Dashboard).dataModels,
        highlights
      );

      return (
        <>
          <Row
            className="p-md border-radius-card summary-panel-card"
            gutter={[0, 8]}>
            <Col span={24}>
              <Typography.Text
                className="summary-panel-section-title"
                data-testid="charts-header">
                {t('label.chart-plural')}
              </Typography.Text>
            </Col>
            <Col span={24}>
              <SummaryList
                formattedEntityData={formattedChartsData}
                loading={loading}
              />
            </Col>
          </Row>

          <Row
            className="p-md border-radius-card summary-panel-card"
            gutter={[0, 8]}>
            <Col span={24}>
              <Typography.Text
                className="summary-panel-section-title"
                data-testid="data-model-header">
                {t('label.data-model-plural')}
              </Typography.Text>
            </Col>
            <Col span={24}>
              <SummaryList formattedEntityData={formattedDataModelData} />
            </Col>
          </Row>
        </>
      );

    case EntityType.MLMODEL:
      heading = t('label.feature-plural');
      headingTestId = 'features-header';
      childComponent = (
        <SummaryList
          formattedEntityData={getFormattedEntityData(
            SummaryEntityType.MLFEATURE,
            (entityInfo as Mlmodel).mlFeatures,
            highlights
          )}
        />
      );

      break;

    case EntityType.CONTAINER:
      heading = t('label.schema');
      childComponent = (
        <SummaryList
          formattedEntityData={getFormattedEntityData(
            SummaryEntityType.COLUMN,
            (entityInfo as Container).dataModel?.columns,
            highlights
          )}
        />
      );

      break;

    case EntityType.DASHBOARD_DATA_MODEL:
      heading = t('label.column-plural');
      headingTestId = 'column-header';
      childComponent = (
        <ColumnSummaryList
          entityInfo={entityInfo as DashboardDataModel}
          entityType={entityType}
          highlights={highlights}
        />
      );

      break;
    case EntityType.STORED_PROCEDURE:
      heading = t('label.code');
      headingTestId = 'code-header';
      childComponent = (
        <SchemaEditor
          editorClass="custom-code-mirror-theme summary-panel-custom-query-editor"
          mode={{ name: CSMode.SQL }}
          options={{
            styleActiveLine: false,
            readOnly: true,
          }}
          value={
            (
              (entityInfo as StoredProcedure)
                .storedProcedureCode as StoredProcedureCodeObject
            )?.code ?? ''
          }
        />
      );

      break;
    case EntityType.SEARCH_INDEX:
      heading = t('label.field-plural');
      headingTestId = 'fields-header';
      childComponent = (
        <SummaryList
          entityType={SummaryEntityType.FIELD}
          formattedEntityData={getFormattedEntityData(
            SummaryEntityType.FIELD,
            (entityInfo as SearchIndex).fields,
            highlights
          )}
        />
      );

      break;
    case EntityType.API_ENDPOINT:
    case EntityType.API_SERVICE:
      return (
        <APIEndpointSummary
          entityDetails={entityInfo as APIEndpoint}
          highlights={highlights}
        />
      );

    case EntityType.METRIC:
      heading = (
        <GenericProvider<Metric>
          data={entityInfo as Metric}
          permissions={{} as OperationPermission}
          type={EntityType.METRIC as CustomizeEntityType}
          onUpdate={() => Promise.resolve()}>
          <MetricExpression />
        </GenericProvider>
      );

      childComponent = (
        <GenericProvider<Metric>
          data={entityInfo as Metric}
          permissions={{} as OperationPermission}
          type={EntityType.METRIC as CustomizeEntityType}
          onUpdate={() => Promise.resolve()}>
          <RelatedMetrics isInSummaryPanel />
        </GenericProvider>
      );

      break;
    case EntityType.DATABASE:
      heading = t('label.schema');
      childComponent = (
        <SummaryList
          entityType={SummaryEntityType.SCHEMAFIELD}
          formattedEntityData={getFormattedEntityData(
            SummaryEntityType.SCHEMAFIELD,
            (entityInfo as Database).databaseSchemas,
            highlights
          )}
        />
      );

      break;
    case EntityType.CHART:
      heading = t('label.dashboard-plural');
      headingTestId = 'dashboard-header';
      childComponent = (
        <SummaryList
          formattedEntityData={getFormattedEntityData(
            SummaryEntityType.DASHBOARD,
            (entityInfo as Chart).dashboards
          )}
        />
      );

      break;
    case EntityType.DATA_PRODUCT:
      return (
        <DataProductSummary
          entityDetails={entityInfo as DataProduct}
          highlights={highlights}
          isLoading={false}
        />
      );

    case EntityType.DOMAIN:
      return (
        <DomainSummary
          entityDetails={entityInfo as Domain}
          highlights={highlights}
          isLoading={false}
        />
      );
    case EntityType.GLOSSARY_TERM:
    case EntityType.GLOSSARY:
      return (
        <GlossaryTermSummary
          entityDetails={entityInfo as GlossaryTerm}
          isLoading={false}
        />
      );
    case EntityType.TAG:
      return (
        <TagsSummary entityDetails={entityInfo as Tag} isLoading={false} />
      );

    case EntityType.DATABASE_SERVICE:
    case EntityType.MESSAGING_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.SEARCH_SERVICE:
    case EntityType.STORAGE_SERVICE:
    case EntityType.API_COLLECTION:
    case EntityType.DATABASE_SCHEMA:
      return null;
    default:
      return searchClassBase.getEntitySummaryComponent(entityInfo);
  }

  return (
    <Row className="p-md border-radius-card summary-panel-card" gutter={[0, 8]}>
      <Col span={24}>
        <Typography.Text
          className="summary-panel-section-title"
          data-testid={headingTestId}>
          {heading}
        </Typography.Text>
      </Col>
      <Col span={24}>{childComponent}</Col>
    </Row>
  );
};
