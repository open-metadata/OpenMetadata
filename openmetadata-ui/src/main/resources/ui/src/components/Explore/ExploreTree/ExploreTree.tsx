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
import { Tooltip, Tree, TreeProps, Typography } from 'antd';
import { DataNode } from 'antd/es/tree';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isString, isUndefined } from 'lodash';
import { Bucket } from 'Models';
import Qs from 'qs';
import { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import { DATA_DISCOVERY_DOCS } from '../../../constants/docs.constants';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { ExplorePageTabs } from '../../../enums/Explore.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getCountBadge } from '../../../utils/EntityDisplayPureUtils';
import { getPluralizeEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  buildTreeCountQueryFilter,
  findTreeNodeKeyByBrowsePath,
  getAggregations,
  getDisabledExploreTreeKeys,
  getExploreQueryFilterMust,
  getQueryFilterMust,
  getQuickFilterMust,
  getQuickFilterObject,
  getQuickFilterObjectForEntities,
  getSubLevelHierarchyKey,
  hasServiceDrillDownFilter,
  isEntityTypeBucketSelected,
  isSelectionWithinBrowsePath,
  parseBrowsePathFields,
  reconcilePresentRoots,
  refreshRootCounts,
  updateTreeData,
  updateTreeDataWithCounts,
} from '../../../utils/ExplorePureUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { generateUUID } from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { UrlParams } from '../ExplorePage.interface';
import './explore-tree.less';
import {
  ExploreTreeNode,
  ExploreTreeProps,
  TreeNodeData,
} from './ExploreTree.interface';
const ExploreTreeTitle = ({ node }: { node: ExploreTreeNode }) => {
  const tooltipText = node.tooltip ?? node.title;

  return (
    <Tooltip
      title={
        <Typography.Text className="text-white">
          {tooltipText}
          {node.type && (
            <span className="text-grey-400">{` (${node.type})`}</span>
          )}
        </Typography.Text>
      }>
      <div
        className={classNames('d-flex justify-between', {
          'tw:opacity-50': node.disabled,
        })}>
        <Typography.Text
          className={classNames({
            'm-l-xss': node.data?.isRoot,
          })}
          data-testid={`explore-tree-title-${node.data?.dataId ?? node.title}`}>
          {node.title}
        </Typography.Text>
        {!isUndefined(node.count) && (
          <span className="explore-node-count">
            {getCountBadge(node.count)}
          </span>
        )}
      </div>
    </Tooltip>
  );
};

const ExploreTree = ({
  additionalQueryFilter,
  onFieldValueSelect,
  onTreeSelect,
  selectedEntityTypes = [],
}: ExploreTreeProps) => {
  const hasFetchedRef = useRef(false); // Use a ref to track if we've already fetched, in dev mode as it will fetch twice
  const hadBrowsePathRef = useRef(false);
  // Caches the unfiltered estate aggregation (category visibility) keyed by the
  // text query, so toggling a filter costs one aggregation instead of two.
  const presenceBucketsRef = useRef<{ key: string; buckets: Bucket[] } | null>(
    null
  );
  // Monotonic id for the latest count fetch. Rapid filter toggles fire
  // overlapping fetches; only the newest may commit so a slow earlier response
  // can't overwrite the tree with stale counts.
  const countFetchSeqRef = useRef(0);
  // The full-screen spinner is for the first load only; later count refreshes
  // update the tree in place so browsing never blanks it out (the "page
  // reload" the user saw on every selection).
  const hasLoadedOnceRef = useRef(false);
  // A tree selection keeps the expanded subtree so browsing does not collapse
  // it; an external filter change (Data Assets dropdown, chip removal) rebuilds
  // from the static roots so deeper counts and entity-type leaves re-fetch
  // fresh under the new filter. Set by onNodeSelect, consumed by the next
  // count refresh.
  const treeSelectRef = useRef(false);
  const { t } = useTranslation();
  const { tab } = useRequiredParams<UrlParams>();
  const initTreeData = searchClassBase.getExploreTree();
  const [treeData, setTreeData] = useState(initTreeData);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  // Latest selection for the browse-path sync effect to read without taking a
  // dependency on it — that would re-run the effect on every click and fight
  // the highlight the click handler just set.
  const selectedKeysRef = useRef<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    selectedKeysRef.current = selectedKeys;
  }, [selectedKeys]);

  const defaultExpandedKeys = useMemo(() => {
    return searchClassBase.getExploreTreeKey(tab as ExplorePageTabs);
  }, [tab]);

  const [expandedKeys, setExpandedKeys] = useState<Key[]>(defaultExpandedKeys);

  const [parsedSearch, searchQueryParam, defaultServiceType] = useMemo(() => {
    const parsedSearch = Qs.parse(
      location.search.startsWith('?')
        ? location.search.substring(1)
        : location.search
    );

    const defaultServiceType = parsedSearch.defaultServiceType;

    const searchQueryParam = isString(parsedSearch.search)
      ? parsedSearch.search
      : '';

    return [parsedSearch, searchQueryParam, defaultServiceType];
  }, [location.search]);

  const onLoadData: TreeProps['loadData'] = useCallback(
    async (treeNode: Parameters<NonNullable<TreeProps['loadData']>>[0]) => {
      try {
        if (treeNode.children || (treeNode as ExploreTreeNode).disabled) {
          return;
        }

        const {
          isRoot = false,
          currentBucketKey,
          currentBucketValue,
          filterField = [],
          rootIndex,
        } = (treeNode as ExploreTreeNode)?.data as TreeNodeData;

        const { bucket: bucketToFind, queryFilter } =
          searchQueryParam !== ''
            ? {
                bucket: EntityFields.ENTITY_TYPE,
                queryFilter: {
                  query: { bool: {} },
                },
              }
            : getSubLevelHierarchyKey(
                rootIndex === SearchIndex.DATABASE,
                (treeNode as ExploreTreeNode)?.data?.filterField,
                currentBucketKey as EntityFields,
                currentBucketValue
              );

        // Count every matching object in each node's subtree over the dataAsset
        // index (so a parent's count is never less than its child's) and reflect
        // the active filters, instead of the per-entity index that counted only
        // the immediate child entities (e.g. databases under a service).
        const countQueryFilter = buildTreeCountQueryFilter({
          baseQueryFilter: queryFilter,
          isRoot,
          childEntities:
            (treeNode as ExploreTreeNode).data?.childEntities ?? [],
          activeQuickFilter: parsedSearch.quickFilter,
          activeBrowsePath: isEmpty(filterField)
            ? parsedSearch.browsePath
            : undefined,
          activeQueryFilter: additionalQueryFilter,
        });

        const res = await searchQuery({
          query: searchQueryParam ?? '',
          pageNumber: 0,
          pageSize: 0,
          queryFilter: countQueryFilter,
          searchIndex: SearchIndex.DATA_ASSET,
          includeDeleted: false,
          trackTotalHits: true,
          fetchSource: false,
        });

        const aggregations = getAggregations(res.aggregations);
        const isServiceType = bucketToFind === EntityFields.SERVICE_TYPE;
        const isEntityType = bucketToFind === EntityFields.ENTITY_TYPE;
        const buckets = (aggregations[bucketToFind]?.buckets ?? []).filter(
          (item) => {
            const isAllowedAggregation = !searchClassBase
              .notIncludeAggregationExploreTree()
              .includes(item.key as EntityType);
            // When specific asset types are picked, the entity-type leaf only
            // lists those types — a Table-only filter must not surface Columns.
            const matchesSelectedType =
              !isEntityType ||
              isEntityTypeBucketSelected(item.key, selectedEntityTypes);

            return isAllowedAggregation && matchesSelectedType;
          }
        );

        const sortedBuckets = buckets.sort((a, b) =>
          a.key.localeCompare(b.key, undefined, { sensitivity: 'base' })
        );

        const children = sortedBuckets.map((bucket) => {
          const id = generateUUID();
          let type = null;
          let logo = undefined;
          if (isEntityType) {
            const isColumn = bucket.key === EntityType.TABLE_COLUMN;
            const iconClass = classNames('service-icon w-4 h-4', {
              'text-grey-500': isColumn,
            });
            logo = searchClassBase.getEntityIcon(bucket.key, iconClass) ?? (
              <></>
            );
          } else if (isServiceType) {
            const serviceIcon = serviceUtilClassBase.getServiceLogo(bucket.key);
            logo = (
              <img
                alt="logo"
                src={serviceIcon}
                style={{ width: 18, height: 18 }}
              />
            );
          } else if (bucketToFind === EntityFields.DATABASE_DISPLAY_NAME) {
            type = 'Database';
            logo = searchClassBase.getEntityIcon(
              'database',
              'service-icon w-4 h-4'
            ) ?? <></>;
          } else if (
            bucketToFind === EntityFields.DATABASE_SCHEMA_DISPLAY_NAME
          ) {
            type = 'Database Schema';
            logo = searchClassBase.getEntityIcon(
              'databaseSchema',
              'service-icon w-4 h-4'
            ) ?? <></>;
          } else if (bucketToFind === EntityFields.SERVICE) {
            logo = treeNode.icon;
          }

          if (bucket.key.toLowerCase() === defaultServiceType) {
            setSelectedKeys([id]);
          }

          const formattedEntityType =
            entityUtilClassBase.getFormattedServiceType(bucket.key);

          return {
            title: isEntityType ? (
              <>{getPluralizeEntityName(bucket.key)}</>
            ) : (
              <>{bucket.key}</>
            ),
            tooltip: formattedEntityType,
            count: bucket.doc_count,
            key: id,
            type,
            icon: logo,
            isLeaf: bucketToFind === EntityFields.ENTITY_TYPE,
            data: {
              currentBucketKey: bucketToFind,
              parentSearchIndex: isRoot ? treeNode.key : SearchIndex.DATA_ASSET,
              currentBucketValue: bucket.key,
              filterField: [
                ...filterField,
                getQuickFilterObject(bucketToFind, bucket.key),
              ],
              isRoot: false,
              rootIndex: isRoot
                ? treeNode.key
                : (treeNode as ExploreTreeNode).data?.rootIndex,
              dataId: bucket.key,
            },
          };
        });

        setTreeData((origin) =>
          updateTreeData(origin, treeNode.key, children as ExploreTreeNode[])
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [
      updateTreeData,
      searchQueryParam,
      defaultServiceType,
      setTreeData,
      selectedEntityTypes,
      parsedSearch,
      additionalQueryFilter,
    ]
  );

  const switcherIcon = useCallback(({ expanded }: { expanded?: boolean }) => {
    return expanded ? <IconDown /> : <IconRight />;
  }, []);

  const onNodeSelect: TreeProps<DataNode>['onSelect'] = useCallback(
    (
      _selectedKeys: Key[],
      info: Parameters<NonNullable<TreeProps['onSelect']>>[1]
    ) => {
      const node = info.node as ExploreTreeNode;
      // This refresh comes from a browse click, so keep the expanded subtree.
      treeSelectRef.current = true;
      const filterField = node.data?.filterField;
      if (filterField) {
        if (node.isLeaf) {
          // Entity-type leaves refine the Type filter; the levels above them
          // are the browse location. Both travel together so the page can
          // update browsePath and quickFilter in a single navigation.
          onTreeSelect({
            browseFields: filterField.slice(0, -1),
            typeField: filterField[filterField.length - 1],
          });
        } else {
          onTreeSelect({ browseFields: filterField });
        }
      } else if (node.isLeaf) {
        onFieldValueSelect([
          getQuickFilterObject(
            EntityFields.ENTITY_TYPE,
            node.data?.entityType ?? ''
          ),
        ]);
      } else if (node.data?.childEntities) {
        const categoryField = {
          ...getQuickFilterObjectForEntities(
            EntityFields.ENTITY_TYPE,
            node.data?.childEntities as EntityType[]
          ),
          // The chip for a category root reads "In <category>" — keep the
          // human title, the key alone only says "entityType".
          label: isString(node.title)
            ? node.title
            : EntityFields.ENTITY_TYPE.toString(),
        };
        onTreeSelect({ browseFields: [categoryField] });
      }

      setSelectedKeys([node.key]);
    },
    [onFieldValueSelect, onTreeSelect]
  );

  const fetchEntityCounts = useCallback(async () => {
    const fetchSeq = ++countFetchSeqRef.current;
    const isLatestFetch = () => fetchSeq === countFetchSeqRef.current;
    // A browse click keeps the expanded subtree; anything else (dropdown filter,
    // chip removal, initial load) rebuilds so deeper counts/leaves re-fetch.
    const preserveExpandedTree = treeSelectRef.current;
    treeSelectRef.current = false;
    try {
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }
      const filterMust = [
        ...getQuickFilterMust(parsedSearch.quickFilter),
        ...getQueryFilterMust(additionalQueryFilter),
        ...getExploreQueryFilterMust(
          parseBrowsePathFields(parsedSearch.browsePath)
        ),
      ];
      const countRes = await searchQuery({
        query: searchQueryParam ?? '',
        pageNumber: 0,
        pageSize: 0,
        queryFilter: { query: { bool: { must: filterMust } } },
        searchIndex: SearchIndex.DATA_ASSET,
        includeDeleted: false,
        trackTotalHits: true,
        fetchSource: false,
      });
      const countBuckets = countRes.aggregations['entityType'].buckets;

      // Category visibility tracks the whole estate, not the filtered view: a
      // category that simply has no matches under the active filter must stay
      // in the tree (grayed for an incompatible asset type, or showing 0 for an
      // unrelated Tier/Owner filter) rather than disappear — so derive it from
      // an unfiltered aggregation while the displayed counts above honor the
      // filter. The unfiltered estate only changes with the text query, so it is
      // cached per query: a no-filter response is reused directly, and a filter
      // change reuses the cache instead of paying for a second aggregation.
      const presenceCacheKey = searchQueryParam ?? '';
      let presenceBuckets: Bucket[];
      if (isEmpty(filterMust)) {
        presenceBuckets = countBuckets;
      } else if (presenceBucketsRef.current?.key === presenceCacheKey) {
        presenceBuckets = presenceBucketsRef.current.buckets;
      } else {
        presenceBuckets = (
          await searchQuery({
            query: searchQueryParam ?? '',
            pageNumber: 0,
            pageSize: 0,
            queryFilter: {},
            searchIndex: SearchIndex.DATA_ASSET,
            includeDeleted: false,
            trackTotalHits: true,
            fetchSource: false,
          })
        ).aggregations['entityType'].buckets;
      }
      // A newer filter change superseded this fetch while it was in flight —
      // drop its result so the tree reflects the latest filter, not this one.
      if (!isLatestFetch()) {
        return;
      }

      presenceBucketsRef.current = {
        key: presenceCacheKey,
        buckets: presenceBuckets,
      };

      // Rebuild the root set from the present static roots so a category an
      // earlier text query dropped can reappear and its counts re-scope to the
      // current filter. On a browse click the live roots are reused so the
      // expanded subtree and selection survive; on an external filter change no
      // live roots are carried over, so the deeper counts and entity-type leaves
      // re-fetch fresh under the new filter on the next expand.
      setTreeData((origin) => {
        const presentRoots = updateTreeDataWithCounts(
          searchClassBase.getExploreTree(),
          presenceBuckets
        ).filter((node) => (node.totalCount ?? 0) > 0);
        const liveRoots = preserveExpandedTree ? origin : [];

        return refreshRootCounts(
          reconcilePresentRoots(presentRoots, liveRoots),
          countBuckets
        );
      });
    } catch {
      // Count fetch is best-effort: on failure the tree degrades to its current
      // structure (browse still works, each node refetches on expand) and the
      // page-level fetch surfaces the user-facing error.
    } finally {
      // Only the latest fetch owns the loading flag; a superseded fetch
      // resolving later must not clear the spinner for the in-flight one.
      if (isLatestFetch()) {
        setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
    }
  }, [
    searchQueryParam,
    setTreeData,
    parsedSearch.quickFilter,
    parsedSearch.browsePath,
    additionalQueryFilter,
  ]);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchEntityCounts();
    }
  }, []);

  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        browsePath: isString(parsedSearch.browsePath)
          ? parsedSearch.browsePath
          : '',
        quickFilter: isString(parsedSearch.quickFilter)
          ? parsedSearch.quickFilter
          : '',
        queryFilter: additionalQueryFilter ?? {},
      }),
    [parsedSearch.browsePath, parsedSearch.quickFilter, additionalQueryFilter]
  );
  const previousFilterRef = useRef(filterSignature);

  useEffect(() => {
    // When the active filters change, rebuild the tree so the deeper levels
    // cached by antd re-fetch and their counts reflect the current query.
    if (previousFilterRef.current !== filterSignature) {
      previousFilterRef.current = filterSignature;
      fetchEntityCounts();
    }
  }, [filterSignature, fetchEntityCounts]);

  useEffect(() => {
    // Hierarchical selections live in browsePath, static leaves in quickFilter
    // — only clear the highlight when neither is active.
    if (isEmpty(parsedSearch.quickFilter) && isEmpty(parsedSearch.browsePath)) {
      setSelectedKeys([]);
    }
  }, [parsedSearch]);

  useEffect(() => {
    // Keep the highlight in sync with the browse-path chips: removing the
    // Service chip moves the selection back up to the matching ancestor
    // (e.g. the category root), and removing the last browse chip clears it.
    // A selection that already sits on the active path — including an
    // entity-type leaf (Tables/Columns) whose parent levels are that path — is
    // left untouched so a count refresh can't snap the leaf back to its schema.
    const browseFields = parseBrowsePathFields(parsedSearch.browsePath);
    if (!isEmpty(browseFields)) {
      if (
        !isSelectionWithinBrowsePath(
          treeData,
          selectedKeysRef.current,
          browseFields
        )
      ) {
        const matchedKey = findTreeNodeKeyByBrowsePath(treeData, browseFields);
        setSelectedKeys(matchedKey ? [matchedKey] : []);
      }
      hadBrowsePathRef.current = true;
    } else if (hadBrowsePathRef.current) {
      hadBrowsePathRef.current = false;
      setSelectedKeys([]);
    }
  }, [parsedSearch.browsePath, treeData]);

  // Top-level categories that cannot hold the selected asset type are grayed
  // out so the user can't browse into services that won't contain it.
  const disabledRootKeys = useMemo(
    () =>
      getDisabledExploreTreeKeys(treeData, selectedEntityTypes, {
        disableEmptyRoots: hasServiceDrillDownFilter(
          parsedSearch.quickFilter,
          parsedSearch.browsePath,
          additionalQueryFilter
        ),
      }),
    [
      treeData,
      selectedEntityTypes,
      parsedSearch.quickFilter,
      parsedSearch.browsePath,
      additionalQueryFilter,
    ]
  );

  const displayTreeData = useMemo(
    () =>
      treeData.map((node) =>
        disabledRootKeys.has(node.key) ? { ...node, disabled: true } : node
      ),
    [treeData, disabledRootKeys]
  );

  // Disabled categories also collapse — an expanded Databases subtree makes
  // no sense once the selected asset type rules the whole category out.
  const visibleExpandedKeys = useMemo(
    () => expandedKeys.filter((key) => !disabledRootKeys.has(String(key))),
    [expandedKeys, disabledRootKeys]
  );

  if (isLoading) {
    return <Loader />;
  }

  if (treeData.length === 0) {
    return (
      <ErrorPlaceHolder
        className="h-min-80 d-flex flex-col justify-center border-none"
        size={SIZE.MEDIUM}
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph
          className="font-medium"
          style={{ marginBottom: '0' }}>
          {t('message.no-data-yet')}
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: '0' }}>
          {t('message.add-service-and-data-assets')}
        </Typography.Paragraph>
        <Typography.Paragraph>
          <Transi18next
            i18nKey="message.need-help-message"
            renderElement={
              <a
                aria-label="Learn more about data discovery"
                href={DATA_DISCOVERY_DOCS}
                rel="noreferrer"
                target="_blank">
                {t('label.learn-more')}
              </a>
            }
            values={{
              doc: t('message.see-how-to-get-started'),
            }}
          />
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <Tree
      blockNode
      showIcon
      className="explore-tree"
      data-testid="explore-tree"
      expandedKeys={visibleExpandedKeys}
      loadData={onLoadData}
      selectedKeys={selectedKeys}
      switcherIcon={switcherIcon}
      titleRender={(node) => (
        <ExploreTreeTitle node={node as ExploreTreeNode} />
      )}
      treeData={displayTreeData as DataNode[]}
      onExpand={(keys) => setExpandedKeys(keys)}
      onSelect={onNodeSelect}
    />
  );
};

export default ExploreTree;
