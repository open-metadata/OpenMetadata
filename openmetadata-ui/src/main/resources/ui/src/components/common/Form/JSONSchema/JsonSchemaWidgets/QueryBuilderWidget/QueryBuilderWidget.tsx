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
import { InfoCircleOutlined } from '@ant-design/icons';
import { WidgetProps } from '@rjsf/utils';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Row,
  Skeleton,
  Typography,
} from 'antd';
import classNames from 'classnames';
import { useEffect } from 'react';

import {
  Actions,
  Builder,
  Config,
  ImmutableTree,
  Query,
  Utils as QbUtils,
} from '@react-awesome-query-builder/antd';
import 'antd/dist/antd.css';
import { debounce, isEmpty, isUndefined } from 'lodash';
import Qs from 'qs';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReferenceFields } from '../../../../../../enums/AdvancedSearch.enum';
import { EntityType } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { QueryFilterInterface } from '../../../../../../pages/ExplorePage/ExplorePage.interface';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  getEmptyJsonTree,
  getEmptyJsonTreeForQueryBuilder,
} from '../../../../../../utils/AdvancedSearchUtils';
import { elasticSearchFormat } from '../../../../../../utils/QueryBuilderElasticsearchFormatUtils';
import {
  addEntityTypeFilter,
  getEntityTypeAggregationFilter,
  getJsonTreeFromQueryFilter,
  READONLY_SETTINGS,
} from '../../../../../../utils/QueryBuilderUtils';
import { getExplorePath } from '../../../../../../utils/RouterUtils';
import searchClassBase from '../../../../../../utils/SearchClassBase';
import { withAdvanceSearch } from '../../../../../AppRouter/withAdvanceSearch';
import { useAdvanceSearch } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { SearchOutputType } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import './query-builder-widget.less';

interface QueryBuilderWidgetProps extends WidgetProps {
  excludeFields?: EntityReferenceFields[];
}

const QueryBuilderWidget: FC<QueryBuilderWidgetProps> = ({
  onChange,
  schema,
  value,
  ...props
}) => {
  const {
    config,
    treeInternal,
    onTreeUpdate,
    onChangeSearchIndex,
    searchIndex: searchIndexFromContext,
    isUpdating,
  } = useAdvanceSearch();
  const [searchResults, setSearchResults] = useState<number | undefined>();
  const [isCountLoading, setIsCountLoading] = useState<boolean>(false);
  const entityType =
    (props.formContext?.entityType ?? schema?.entityType) || EntityType.ALL;
  const searchIndexMapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const searchIndex = searchIndexMapping[entityType as string];
  const outputType = schema?.outputType ?? SearchOutputType.ElasticSearch;
  const isSearchIndexUpdatedInContext = searchIndexFromContext === searchIndex;
  const [initDone, setInitDone] = useState<boolean>(false);
  const { t } = useTranslation();
  const [queryURL, setQueryURL] = useState<string>('');
  const [queryActions, setQueryActions] = useState<Actions>();

  // Filter config fields based on fieldsToRender prop
  const filteredConfig = useMemo(() => {
    if (isEmpty(props.excludeFields)) {
      return config;
    }

    const filteredFields: Record<string, any> = {};

    // Filter fields based on fieldsToRender
    Object.entries(config.fields).forEach(([fieldKey, fieldConfig]) => {
      if (
        !(props.excludeFields ?? []).includes(fieldKey as EntityReferenceFields)
      ) {
        filteredFields[fieldKey] = fieldConfig;
      }
    });

    return {
      ...config,
      fields: filteredFields,
    };
  }, [config, props.excludeFields]);

  const fetchEntityCount = useCallback(
    async (queryFilter: Record<string, unknown>) => {
      const qFilter = getEntityTypeAggregationFilter(
        queryFilter as unknown as QueryFilterInterface,
        entityType
      );

      const tree = QbUtils.sanitizeTree(
        QbUtils.loadTree(getJsonTreeFromQueryFilter(qFilter)),
        filteredConfig
      ).fixedTree;

      const queryFilterString = !isEmpty(tree)
        ? Qs.stringify({ queryFilter: JSON.stringify(tree) })
        : '';

      setQueryURL(`${getExplorePath({})}${queryFilterString}`);

      try {
        setIsCountLoading(true);
        const res = await searchQuery({
          query: '',
          pageNumber: 0,
          pageSize: 0,
          queryFilter: qFilter as unknown as Record<string, unknown>,
          searchIndex: SearchIndex.ALL,
          includeDeleted: false,
          trackTotalHits: true,
          fetchSource: false,
        });
        setSearchResults(res.hits.total.value ?? 0);
      } catch {
        // silent fail
      } finally {
        setIsCountLoading(false);
      }
    },
    [entityType]
  );

  const debouncedFetchEntityCount = useMemo(
    () => debounce(fetchEntityCount, 300),
    [fetchEntityCount]
  );

  const showFilteredResourceCount = useMemo(
    () =>
      outputType === SearchOutputType.ElasticSearch &&
      !isUndefined(value) &&
      searchResults !== undefined &&
      !isCountLoading,
    [outputType, value, isCountLoading]
  );

  const handleChange = (nTree: ImmutableTree, nConfig: Config) => {
    onTreeUpdate(nTree, nConfig);

    if (outputType === SearchOutputType.ElasticSearch) {
      const data = elasticSearchFormat(nTree, filteredConfig) ?? '';
      const qFilter = {
        query: data,
      };
      if (data) {
        const qFilterWithEntityType = addEntityTypeFilter(
          qFilter as unknown as QueryFilterInterface,
          entityType
        );

        debouncedFetchEntityCount(
          qFilterWithEntityType as unknown as Record<string, unknown>
        );
      }

      onChange(!isEmpty(data) ? JSON.stringify(qFilter) : '');
    } else {
      try {
        const jsonLogic = QbUtils.jsonLogicFormat(nTree, filteredConfig);
        onChange(JSON.stringify(jsonLogic.logic ?? ''));
      } catch {
        onChange('');
      }
    }
  };

  const loadDefaultValueInTree = useCallback(() => {
    if (!isEmpty(value)) {
      const parsedValue = JSON.parse(value ?? '{}');
      if (outputType === SearchOutputType.ElasticSearch) {
        const parsedTree = getJsonTreeFromQueryFilter(
          parsedValue,
          filteredConfig.fields
        );

        if (Object.keys(parsedTree).length > 0) {
          const tree = QbUtils.Validation.sanitizeTree(
            QbUtils.loadTree(parsedTree),
            filteredConfig
          ).fixedTree;
          onTreeUpdate(tree, filteredConfig);
          // Fetch count for default value
          debouncedFetchEntityCount(parsedValue);
        }
      } else {
        const tree = QbUtils.loadFromJsonLogic(parsedValue, filteredConfig);
        if (tree) {
          const validatedTree = QbUtils.Validation.sanitizeTree(
            tree,
            filteredConfig
          ).fixedTree;
          onTreeUpdate(validatedTree, filteredConfig);
        }
      }
    } else {
      const emptyJsonTree =
        outputType === SearchOutputType.JSONLogic
          ? getEmptyJsonTreeForQueryBuilder(EntityReferenceFields.GLOSSARY_TERM)
          : getEmptyJsonTree();

      const tree = QbUtils.loadTree(emptyJsonTree);

      onTreeUpdate(tree, filteredConfig);
    }
    setInitDone(true);
  }, [filteredConfig, value, outputType]);

  useEffect(() => {
    onChangeSearchIndex(searchIndex);
  }, []);

  useEffect(() => {
    if (isSearchIndexUpdatedInContext && !isUpdating) {
      loadDefaultValueInTree();
    }
  }, [isSearchIndexUpdatedInContext, isUpdating]);

  useEffect(() => {
    if (props.getQueryActions) {
      props.getQueryActions(queryActions);
    }
  }, [queryActions]);

  if (!initDone) {
    return <></>;
  }

  return (
    <div
      className="query-builder-form-field"
      data-testid="query-builder-form-field">
      <Card className={classNames('query-builder-card', outputType)}>
        <Row gutter={[8, 8]}>
          <Col
            className={classNames({
              'p-t-sm': outputType === SearchOutputType.ElasticSearch,
            })}
            span={24}>
            {outputType === SearchOutputType.JSONLogic && (
              <>
                <Typography.Text className="query-filter-label text-grey-muted">
                  {props.label}
                </Typography.Text>
                <Divider className="m-y-sm" />
              </>
            )}
            <Query
              {...filteredConfig}
              renderBuilder={(props) => {
                // Store the actions for external access
                if (!queryActions) {
                  setQueryActions(props.actions);
                }

                return (
                  <div className="query-builder-container query-builder qb-lite">
                    <Builder {...props} />
                  </div>
                );
              }}
              settings={{
                ...filteredConfig.settings,
                ...(props.readonly ? READONLY_SETTINGS : {}),
                removeEmptyGroupsOnLoad: false,
                removeEmptyRulesOnLoad: false,
                shouldCreateEmptyGroup: true,
              }}
              value={treeInternal}
              onChange={handleChange}
            />

            {isCountLoading && (
              <Skeleton
                active
                className="m-t-sm"
                loading={isCountLoading}
                paragraph={false}
                title={{ style: { height: '32px' } }}
              />
            )}

            {showFilteredResourceCount && (
              <div className="m-t-sm">
                <Button
                  className="w-full p-0 text-left h-auto"
                  data-testid="view-assets-banner-button"
                  disabled={false}
                  href={queryURL}
                  target="_blank"
                  type="link">
                  <Alert
                    closable
                    showIcon
                    icon={<InfoCircleOutlined height={16} />}
                    message={
                      <div className="d-flex flex-wrap items-center gap-1">
                        <Typography.Text>
                          {t('message.search-entity-count', {
                            count: searchResults,
                          })}
                        </Typography.Text>

                        <Typography.Text className="text-xs text-grey-muted">
                          {t('message.click-here-to-view-assets-on-explore')}
                        </Typography.Text>
                      </div>
                    }
                    type="info"
                  />
                </Button>
              </div>
            )}
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default withAdvanceSearch(QueryBuilderWidget, {
  isExplorePage: false,
});
