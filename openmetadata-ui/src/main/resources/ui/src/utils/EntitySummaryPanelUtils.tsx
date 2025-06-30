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
import { get, isEmpty, isUndefined } from 'lodash';
import { Link } from 'react-router-dom';
import { SearchedDataProps } from '../../src/components/SearchedData/SearchedData.interface';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import { GenericProvider } from '../components/Customization/GenericProvider/GenericProvider';
import SchemaEditor from '../components/Database/SchemaEditor/SchemaEditor';
import APIEndpointSummary from '../components/Explore/EntitySummaryPanel/APIEndpointSummary/APIEndpointSummary';
import { ColumnSummaryList } from '../components/Explore/EntitySummaryPanel/ColumnSummaryList/ColumnsSummaryList';
import DataProductSummary from '../components/Explore/EntitySummaryPanel/DataProductSummary/DataProductSummary.component';
import DomainSummary from '../components/Explore/EntitySummaryPanel/DomainSummary/DomainSummary.component';
import GlossaryTermSummary from '../components/Explore/EntitySummaryPanel/GlossaryTermSummary/GlossaryTermSummary.component';
import SummaryList from '../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.component';
import {
  BasicEntityInfo,
  HighlightedTagLabel,
} from '../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
import TagsSummary from '../components/Explore/EntitySummaryPanel/TagsSummary/TagsSummary.component';
import MetricExpression from '../components/Metric/MetricExpression/MetricExpression';
import RelatedMetrics from '../components/Metric/RelatedMetrics/RelatedMetrics';
import { ICON_DIMENSION, NO_DATA_PLACEHOLDER } from '../constants/constants';
import { CustomizeEntityType } from '../constants/Customize.constants';
import { SummaryListHighlightKeys } from '../constants/EntitySummaryPanelUtils.constant';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { CSMode } from '../enums/codemirror.enum';
import { EntityType } from '../enums/entity.enum';
import { SummaryEntityType } from '../enums/EntitySummary.enum';
import { Tag } from '../generated/entity/classification/tag';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Chart } from '../generated/entity/data/chart';
import { Container, TagLabel } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Database } from '../generated/entity/data/database';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { Metric } from '../generated/entity/data/metric';
import { MlFeature, Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline, Task } from '../generated/entity/data/pipeline';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../generated/entity/data/storedProcedure';
import { Column, Table, TableConstraint } from '../generated/entity/data/table';
import { Field, Topic } from '../generated/entity/data/topic';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { Domain } from '../generated/entity/domains/domain';
import { EntityReference } from '../generated/tests/testCase';
import entityUtilClassBase from './EntityUtilClassBase';
import { getEntityName } from './EntityUtils';
import { t } from './i18next/LocalUtil';
import searchClassBase from './SearchClassBase';
import { stringToHTML } from './StringsUtils';

const { Text } = Typography;

export type SummaryListItem = Column | Field | Chart | Task | MlFeature;

export interface ListItemHighlights {
  highlightedTags?: BasicEntityInfo['tags'];
  highlightedTitle?: string;
  highlightedDescription?: string;
}

/* @param {
    listItem: SummaryItem,
    highlightedTitle: will be a string if the title of given summaryItem is present in highlights | undefined
}

    @return SummaryItemTitle
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

/* @param {
    entityType: will be any type of SummaryEntityType,
    listItem: SummaryItem
}
    @return listItemType
*/
export const getSummaryListItemType = (
  entityType: SummaryEntityType,
  listItem: SummaryListItem
): BasicEntityInfo['type'] => {
  switch (entityType) {
    case SummaryEntityType.COLUMN:
    case SummaryEntityType.FIELD:
    case SummaryEntityType.MLFEATURE:
    case SummaryEntityType.SCHEMAFIELD:
      return (listItem as Column | Field | MlFeature).dataType;
    case SummaryEntityType.CHART:
      return (listItem as Chart).chartType;
    case SummaryEntityType.TASK:
      return (listItem as Task).taskType;
    default:
      return '';
  }
};

/*
    @params {
        sortTagsBasedOnGivenTagFQNs: array of TagFQNs,
        tags: Tags array,
    }

    @return array of tags highlighted and sorted if tagFQN present in sortTagsBasedOnGivenTagFQNs
*/
export const getSortedTagsWithHighlight = (
  tags: TagLabel[] = [],
  sortTagsBasedOnGivenTagFQNs: string[] = []
): ListItemHighlights['highlightedTags'] => {
  const { sortedTags, remainingTags } = tags.reduce(
    (acc, tag) => {
      if (sortTagsBasedOnGivenTagFQNs.includes(tag.tagFQN)) {
        acc.sortedTags.push({ ...tag, isHighlighted: true });
      } else {
        acc.remainingTags.push(tag);
      }

      return acc;
    },
    {
      sortedTags: [] as HighlightedTagLabel[],
      remainingTags: [] as TagLabel[],
    }
  );

  return [...sortedTags, ...remainingTags];
};

/* 
    @param {highlights: all the other highlights come from the query api
        only omitted displayName and description key as it is already updated in parent component
    }

    @return {
        listHighlights: single array of all highlights get from query api 
        listHighlightsMap: to reduce the search time complexity in listHighlight
    }

    Todo: apply highlights on entityData in parent where we apply highlight for entityDisplayName and entityDescription
    for that we need to update multiple summary components
*/
export const getMapOfListHighlights = (
  highlights?: SearchedDataProps['data'][number]['highlight']
): {
  listHighlights: string[];
  listHighlightsMap: { [key: string]: number };
} => {
  // checking for the all highlight key present in highlight get from query api
  // and create a array of highlights
  const listHighlights: string[] = [];
  SummaryListHighlightKeys.forEach((highlightKey) => {
    listHighlights.push(...get(highlights, highlightKey, []));
  });

  // using hashmap methodology to reduce the search time complexity from O(n) to O(1)
  // to get highlight from the listHighlights array for applying highlight
  const listHighlightsMap: { [key: string]: number } = {};

  listHighlights?.reduce((acc, colHighlight, index) => {
    acc[colHighlight.replaceAll(/<\/?span(.*?)>/g, '')] = index;

    return acc;
  }, listHighlightsMap);

  return { listHighlights, listHighlightsMap };
};

/*
    @params {
        listItem: SummaryItem
        tagsHighlights: tagFQNs array to highlight and sort tags
        listHighlights: single array of all highlights get from query api 
        listHighlightsMap: to reduce the search time complexity in listHighlight
    }
    @return highlights of listItem
*/
export const getHighlightOfListItem = (
  listItem: SummaryListItem,
  tagHighlights: string[],
  listHighlights: string[],
  listHighlightsMap: { [key: string]: number }
): ListItemHighlights => {
  let highlightedTags;
  let highlightedTitle;
  let highlightedDescription;

  // if any of the listItem.tags present in given tagHighlights list then sort and highlights the tag
  const shouldSortListItemTags = listItem.tags?.find((tag) =>
    tagHighlights.includes(tag.tagFQN)
  );

  if (shouldSortListItemTags) {
    highlightedTags = getSortedTagsWithHighlight(listItem.tags, tagHighlights);
  }

  // highlightedListItemNameIndex will be undefined if listItem.name is not present in highlights
  const highlightedListItemNameIndex = listHighlightsMap[listItem.name ?? ''];

  const shouldApplyHighlightOnTitle = !isUndefined(
    highlightedListItemNameIndex
  );

  if (shouldApplyHighlightOnTitle) {
    highlightedTitle = listHighlights[highlightedListItemNameIndex];
  }

  // highlightedListItemDescriptionIndex will be undefined if listItem.description is not present in highlights
  const highlightedListItemDescriptionIndex =
    listHighlightsMap[listItem.description ?? ''];

  const shouldApplyHighlightOnDescription = !isUndefined(
    highlightedListItemDescriptionIndex
  );

  if (shouldApplyHighlightOnDescription) {
    highlightedDescription =
      listHighlights[highlightedListItemDescriptionIndex];
  }

  return {
    highlightedTags,
    highlightedTitle,
    highlightedDescription,
  };
};

/*
    @params {
        entityType: SummaryEntityType,
        entityInfo: Array<SummaryListItem> = [],
        highlights: highlights get from the query api + highlights added for tags (i.e. tag.name)
        tableConstraints: only pass for SummayEntityType.Column
    }
    @return sorted and highlighted listItem array, but listItem will be type of BasicEntityInfo
    
    Note: SummaryItem will be sort and highlight only if -
        # if listItem.tags present in highlights.tags
        # if listItem.name present in highlights comes from query api
        # if listItem.description present in highlights comes from query api
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

  // Only go ahead if entityType is present in SummaryEntityType enum
  if (Object.values(SummaryEntityType).includes(entityType)) {
    // tagHighlights is the array of tagFQNs for highlighting tags
    const tagHighlights = get(highlights, 'tag.name', [] as string[]);

    // listHighlights i.e. highlight get from query api
    // listHighlightsMap i.e. map of highlight get from api to reduce search time complexity in highlights array
    const { listHighlights, listHighlightsMap } =
      getMapOfListHighlights(highlights);

    const entityHasChildren = [
      SummaryEntityType.COLUMN,
      SummaryEntityType.FIELD,
      SummaryEntityType.SCHEMAFIELD,
    ].includes(entityType);

    const { highlightedListItem, remainingListItem } = entityInfo.reduce(
      (acc, listItem) => {
        // return the highlight of listItem
        const { highlightedTags, highlightedTitle, highlightedDescription } =
          getHighlightOfListItem(
            listItem,
            tagHighlights,
            listHighlights,
            listHighlightsMap
          );

        // convert listItem in BasicEntityInfo type
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

        // if highlights present in listItem then sort the listItem
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
            ).code ?? ''
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
    case EntityType.API_SERVICE:
      return (
        <APIEndpointSummary
          entityDetails={entityInfo as APIEndpoint}
          highlights={highlights}
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
