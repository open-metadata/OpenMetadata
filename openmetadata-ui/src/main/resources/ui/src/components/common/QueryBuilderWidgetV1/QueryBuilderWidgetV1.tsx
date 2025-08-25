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
  JsonTree,
  ListValues,
  Query,
  Utils as QbUtils,
} from '@react-awesome-query-builder/antd';
import 'antd/dist/antd.css';
import { debounce, isEmpty, isUndefined } from 'lodash';
import Qs from 'qs';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getEmptyJsonTreeForQueryBuilder,
  getTreeConfig,
} from '../../../utils/AdvancedSearchUtils';
import { elasticSearchFormat } from '../../../utils/QueryBuilderElasticsearchFormatUtils';
import {
  addEntityTypeFilter,
  getEntityTypeAggregationFilter,
  getJsonTreeFromQueryFilter,
  READONLY_SETTINGS,
} from '../../../utils/QueryBuilderUtils';
import { getExplorePath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';

const QueryBuilderWidgetV1: FC<{
  fields?: Config['fields'];
  onChange?: (value: string, tree?: ImmutableTree) => void;
  entityType?: EntityType;
  outputType?: SearchOutputType;
  value?: string;
  readonly?: boolean;
  getQueryActions?: (actions: Actions) => void;
  label?: string;
  tree?: JsonTree;
}> = ({
  onChange,
  entityType = EntityType.ALL,
  outputType = SearchOutputType.ElasticSearch,
  value,
  fields,
  ...props
}) => {
  const [searchResults, setSearchResults] = useState<number | undefined>();
  const [isCountLoading, setIsCountLoading] = useState<boolean>(false);

  const searchIndexMapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const searchIndex = searchIndexMapping[entityType as string];
  const [config, setConfig] = useState<Config>(
    getTreeConfig({
      searchIndex: searchIndex,
      searchOutputType: outputType,
      isExplorePage: false,
      tierOptions: new Promise<ListValues>((resolve) => resolve([])),
    })
  );
  const [treeInternal, setTreeInternal] = useState<ImmutableTree>(
    QbUtils.checkTree(
      QbUtils.loadTree(props.tree ?? getEmptyJsonTreeForQueryBuilder()),
      config
    )
  );

  const { t } = useTranslation();
  const [queryURL, setQueryURL] = useState<string>('');
  const [queryActions, setQueryActions] = useState<Actions>();

  const onTreeUpdate = (nTree: ImmutableTree, nConfig: Config) => {
    setTreeInternal(nTree);
    setConfig(nConfig);
  };

  const fetchEntityCount = useCallback(
    async (queryFilter: Record<string, unknown>) => {
      const qFilter = getEntityTypeAggregationFilter(
        queryFilter as unknown as QueryFilterInterface,
        entityType
      );

      const tree = QbUtils.sanitizeTree(
        QbUtils.loadTree(getJsonTreeFromQueryFilter(qFilter)),
        config
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
      const data = elasticSearchFormat(nTree, config) ?? '';
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

      onChange?.(!isEmpty(data) ? JSON.stringify(qFilter) : '');
    } else {
      try {
        const jsonLogic = QbUtils.jsonLogicFormat(nTree, config);
        onChange?.(JSON.stringify(jsonLogic.logic ?? ''), nTree);
      } catch {
        onChange?.('', nTree);
      }
    }
  };

  useEffect(() => {
    if (props.getQueryActions && queryActions) {
      props.getQueryActions(queryActions);
    }
  }, [queryActions]);

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
              fields={fields ?? config.fields}
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
                ...config.settings,
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

export default QueryBuilderWidgetV1;
