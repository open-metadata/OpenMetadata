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

import {
  Builder,
  Config,
  ImmutableTree,
  JsonTree,
  Query,
  Utils as QbUtils,
} from '@react-awesome-query-builder/antd';
import 'antd/dist/antd.css';
import { debounce, isEmpty, isUndefined } from 'lodash';
import Qs from 'qs';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import {
  EsBoolQuery,
  QueryFieldInterface,
} from '../../../../../../pages/ExplorePage/ExplorePage.interface';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  elasticSearchFormat,
  elasticSearchFormatForJSONLogic,
} from '../../../../../../utils/QueryBuilderElasticsearchFormatUtils';
import {
  elasticsearchToJsonLogic,
  getJsonTreeFromQueryFilter,
  jsonLogicToElasticsearch,
  READONLY_SETTINGS,
} from '../../../../../../utils/QueryBuilderUtils';
import { getExplorePath } from '../../../../../../utils/RouterUtils';
import searchClassBase from '../../../../../../utils/SearchClassBase';
import { withAdvanceSearch } from '../../../../../AppRouter/withAdvanceSearch';
import { useAdvanceSearch } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { SearchOutputType } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import './query-builder-widget.less';

const QueryBuilderWidget: FC<WidgetProps> = ({
  onChange,
  schema,
  value,
  ...props
}: WidgetProps) => {
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

  const fetchEntityCount = useCallback(
    async (queryFilter: Record<string, unknown>) => {
      try {
        setIsCountLoading(true);
        const res = await searchQuery({
          query: '',
          pageNumber: 0,
          pageSize: 0,
          queryFilter,
          searchIndex: SearchIndex.ALL,
          includeDeleted: false,
          trackTotalHits: true,
          fetchSource: false,
        });
        setSearchResults(res.hits.total.value ?? 0);
      } catch (_) {
        // silent fail
      } finally {
        setIsCountLoading(false);
      }
    },
    []
  );

  const debouncedFetchEntityCount = useMemo(
    () => debounce(fetchEntityCount, 300),
    [fetchEntityCount]
  );

  const queryURL = useMemo(() => {
    const queryFilterString = !isEmpty(treeInternal)
      ? Qs.stringify({ queryFilter: JSON.stringify(treeInternal) })
      : '';

    return `${getExplorePath({})}${queryFilterString}`;
  }, [treeInternal]);

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
      const data = elasticSearchFormat(nTree, config) ?? '';
      const qFilter = {
        query: data,
      };
      if (data) {
        if (entityType !== EntityType.ALL) {
          // Scope the search to the passed entity type
          if (
            Array.isArray(
              ((qFilter.query as QueryFieldInterface)?.bool as EsBoolQuery)
                ?.must
            )
          ) {
            (
              (qFilter.query as QueryFieldInterface)?.bool
                ?.must as QueryFieldInterface[]
            )?.push({
              bool: {
                must: [
                  {
                    term: {
                      entityType: entityType,
                    },
                  },
                ],
              },
            });
          }
        }
        debouncedFetchEntityCount(qFilter);
      }

      onChange(!isEmpty(data) ? JSON.stringify(qFilter) : '');
    } else {
      const outputEs = elasticSearchFormatForJSONLogic(nTree, config);
      if (outputEs) {
        const qFilter = {
          query: outputEs,
        };
        try {
          const jsonLogicData = elasticsearchToJsonLogic(qFilter.query);
          onChange(JSON.stringify(jsonLogicData ?? ''));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(e);
        }
      } else {
        onChange(''); // Set empty string if outputEs is null, this happens when removing all the filters
      }
    }
  };

  const loadDefaultValueInTree = useCallback(() => {
    if (!isEmpty(value)) {
      if (outputType === SearchOutputType.ElasticSearch) {
        const parsedTree = getJsonTreeFromQueryFilter(
          JSON.parse(value || ''),
          config.fields
        ) as JsonTree;

        if (Object.keys(parsedTree).length > 0) {
          const tree = QbUtils.Validation.sanitizeTree(
            QbUtils.loadTree(parsedTree),
            config
          );
          onTreeUpdate(tree as unknown as ImmutableTree, config);
        }
      } else {
        try {
          const query = jsonLogicToElasticsearch(
            JSON.parse(value || ''),
            config.fields
          );
          const updatedQ = {
            query: query,
          };
          const parsedTree = getJsonTreeFromQueryFilter(
            updatedQ,
            config.fields
          ) as JsonTree;

          if (Object.keys(parsedTree).length > 0) {
            const tree1 = QbUtils.Validation.sanitizeTree(
              QbUtils.loadTree(parsedTree),
              config
            );
            if (tree1) {
              onTreeUpdate(tree1 as unknown as ImmutableTree, config);
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(e);
        }
      }
    }
    setInitDone(true);
  }, [config, value, outputType]);

  useEffect(() => {
    onChangeSearchIndex(searchIndex);
  }, []);

  useEffect(() => {
    if (isSearchIndexUpdatedInContext && !isUpdating) {
      loadDefaultValueInTree();
    }
  }, [isSearchIndexUpdatedInContext, isUpdating]);

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
              {...config}
              renderBuilder={(props) => (
                <div className="query-builder-container query-builder qb-lite">
                  <Builder {...props} />
                </div>
              )}
              settings={{
                ...config.settings,
                ...(props.readonly ? READONLY_SETTINGS : {}),
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
  fieldOverrides: [{ field: 'extension', type: '!struct' }],
});
