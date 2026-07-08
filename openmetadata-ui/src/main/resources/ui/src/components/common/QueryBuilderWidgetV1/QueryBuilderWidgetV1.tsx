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
import {
  Alert,
  Card,
  Divider,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Actions,
  Builder,
  BuilderProps,
  ButtonProps,
  Config,
  ConfigContext,
  ImmutableTree,
  JsonTree,
  Query,
  Utils as QbUtils,
} from '@react-awesome-query-builder/ui';
import '@react-awesome-query-builder/ui/css/styles.css';
import { InfoCircle } from '@untitledui/icons';
import classNames from 'classnames';
import { debounce, isEmpty, isUndefined } from 'lodash';
import Qs from 'qs';
import {
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getEmptyJsonTreeForQueryBuilder } from '../../../utils/AdvancedSearchPureUtils';
import { getTreeConfig } from '../../../utils/AdvancedSearchUtils';
import { elasticSearchFormat } from '../../../utils/QueryBuilderElasticsearchFormatUtils';
import {
  addEntityTypeFilter,
  getEntityTypeAggregationFilter,
  getJsonTreeFromQueryFilter,
  READONLY_SETTINGS,
} from '../../../utils/QueryBuilderPureUtils';
import { getExplorePath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import './query-builder-widget-v1.less';

const QueryBuilderWidgetV1: FC<{
  fields?: Config['fields'];
  onChange?: (value: string, tree?: JsonTree) => void;
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
  const baseConfig = useMemo(
    () =>
      getTreeConfig({
        searchIndex: searchIndex,
        searchOutputType: outputType,
        isExplorePage: false,
      }),
    [searchIndex, outputType]
  );
  const [config, setConfig] = useState<Config>({
    ...baseConfig,
    fields: fields ?? baseConfig.fields,
    settings: {
      ...baseConfig.settings,
      ...(props.readonly ? READONLY_SETTINGS : {}),
      removeEmptyGroupsOnLoad: false,
      removeEmptyRulesOnLoad: false,
      shouldCreateEmptyGroup: true,
    },
  });
  const [treeInternal, setTreeInternal] = useState<ImmutableTree>(
    QbUtils.checkTree(
      QbUtils.loadTree(props.tree ?? getEmptyJsonTreeForQueryBuilder()),
      config
    )
  );

  const { t } = useTranslation();
  const [queryURL, setQueryURL] = useState<string>('');
  const queryActionsRef = useRef<Actions>();

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

      const queryFilterString = isEmpty(tree)
        ? ''
        : Qs.stringify({ queryFilter: JSON.stringify(tree) });
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
        setSearchResults(0);
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

      onChange?.(isEmpty(data) ? '' : JSON.stringify(qFilter));
    } else {
      const jsonTree = QbUtils.getTree(nTree);
      try {
        const jsonLogic = QbUtils.jsonLogicFormat(nTree, config);
        onChange?.(JSON.stringify(jsonLogic.logic ?? ''), jsonTree);
      } catch {
        onChange?.('', jsonTree);
      }
    }
  };

  useEffect(() => {
    if (props.getQueryActions && queryActionsRef.current) {
      props.getQueryActions(queryActionsRef.current);
    }
  }, [treeInternal, props.getQueryActions]);

  const hasOnlyOneRule = useMemo(
    () => (QbUtils.getTree(treeInternal).children1?.length ?? 0) <= 1,
    [treeInternal]
  );

  const renderBuilder = useCallback(
    (builderProps: BuilderProps) => {
      queryActionsRef.current = builderProps.actions;
      const builderConfig = {
        ...builderProps.config,
        settings: {
          ...builderProps.config?.settings,
          renderButton: (btnProps: ButtonProps, ctx?: ConfigContext) => {
            if (
              (hasOnlyOneRule && btnProps.type === 'delRule') ||
              !builderProps.config?.settings?.renderButton
            ) {
              return null as unknown as ReactElement<typeof btnProps>;
            }

            return builderProps.config?.settings?.renderButton?.(btnProps, ctx);
          },
        },
      };

      return (
        <div className="query-builder-container query-builder qb-lite">
          <Builder {...builderProps} config={builderConfig} />
        </div>
      );
    },
    [hasOnlyOneRule]
  );

  return (
    <div
      className="query-builder-form-field"
      data-testid="query-builder-form-field">
      <Card className={classNames('query-builder-card', outputType)}>
        <Card.Content>
          {outputType === SearchOutputType.JSONLogic && props.label && (
            <>
              <Typography
                as="span"
                className="query-filter-label tw:text-tertiary"
                size="text-sm">
                {props.label}
              </Typography>
              <Divider className="tw:my-2" />
            </>
          )}

          <div
            className={classNames({
              'tw:pt-2': outputType === SearchOutputType.ElasticSearch,
            })}>
            <Query
              {...config}
              renderBuilder={renderBuilder}
              value={treeInternal}
              onChange={handleChange}
            />
          </div>

          {isCountLoading && (
            <Skeleton
              animation="pulse"
              className="tw:mt-2"
              height={32}
              variant="rectangular"
            />
          )}

          {showFilteredResourceCount && (
            <a
              className="tw:mt-2 tw:block tw:no-underline"
              data-testid="view-assets-banner-button"
              href={queryURL}
              rel="noreferrer"
              target="_blank">
              <Alert
                closable
                icon={InfoCircle}
                title={t('message.search-entity-count', {
                  count: searchResults,
                })}
                variant="brand">
                <Typography as="span" size="text-xs">
                  {t('message.click-here-to-view-assets-on-explore')}
                </Typography>
              </Alert>
            </a>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default QueryBuilderWidgetV1;
