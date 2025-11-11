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
import { getCountBadge, Transi18next } from '../../../utils/CommonUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getPluralizeEntityName } from '../../../utils/EntityUtils';
import {
  getAggregations,
  getQuickFilterObject,
  getQuickFilterObjectForEntities,
  getSubLevelHierarchyKey,
  updateTreeData,
  updateTreeDataWithCounts,
} from '../../../utils/ExploreUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { generateUUID } from '../../../utils/StringsUtils';
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
      <div className="d-flex justify-between">
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

const ExploreTree = ({ onFieldValueSelect }: ExploreTreeProps) => {
  const hasFetchedRef = useRef(false); // Use a ref to track if we've already fetched, in dev mode as it will fetch twice
  const { t } = useTranslation();
  const { tab } = useRequiredParams<UrlParams>();
  const initTreeData = searchClassBase.getExploreTree();
  const [treeData, setTreeData] = useState(initTreeData);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const defaultExpandedKeys = useMemo(() => {
    return searchClassBase.getExploreTreeKey(tab as ExplorePageTabs);
  }, [tab]);

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
        if (treeNode.children) {
          return;
        }

        const {
          isRoot = false,
          currentBucketKey,
          currentBucketValue,
          filterField = [],
          rootIndex,
        } = (treeNode as ExploreTreeNode)?.data as TreeNodeData;

        const searchIndex = isRoot
          ? treeNode.key
          : (treeNode as ExploreTreeNode)?.data?.parentSearchIndex;

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

        const res = await searchQuery({
          query: searchQueryParam ?? '',
          pageNumber: 0,
          pageSize: 0,
          queryFilter: queryFilter,
          searchIndex: searchIndex as SearchIndex,
          includeDeleted: false,
          trackTotalHits: true,
          fetchSource: false,
        });

        const aggregations = getAggregations(res.aggregations);
        const buckets = aggregations[bucketToFind].buckets.filter(
          (item) =>
            !searchClassBase
              .notIncludeAggregationExploreTree()
              .includes(item.key as EntityType)
        );
        const isServiceType = bucketToFind === EntityFields.SERVICE_TYPE;
        const isEntityType = bucketToFind === EntityFields.ENTITY_TYPE;

        const sortedBuckets = buckets.sort((a, b) =>
          a.key.localeCompare(b.key, undefined, { sensitivity: 'base' })
        );

        const children = sortedBuckets.map((bucket) => {
          const id = generateUUID();
          let type = null;
          let logo = undefined;
          if (isEntityType) {
            logo = searchClassBase.getEntityIcon(
              bucket.key,
              'service-icon w-4 h-4'
            ) ?? <></>;
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
            count: isEntityType ? bucket.doc_count : undefined,
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
    [updateTreeData, searchQueryParam, defaultServiceType, setTreeData]
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
      const filterField = node.data?.filterField;
      if (filterField) {
        onFieldValueSelect(filterField);
      } else if (node.isLeaf) {
        const filterField = [
          getQuickFilterObject(
            EntityFields.ENTITY_TYPE,
            node.data?.entityType ?? ''
          ),
        ];
        onFieldValueSelect(filterField);
      } else if (node.data?.childEntities) {
        onFieldValueSelect([
          getQuickFilterObjectForEntities(
            EntityFields.ENTITY_TYPE,
            node.data?.childEntities as EntityType[]
          ),
        ]);
      }

      setSelectedKeys([node.key]);
    },
    [onFieldValueSelect]
  );

  const fetchEntityCounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await searchQuery({
        query: searchQueryParam ?? '',
        pageNumber: 0,
        pageSize: 0,
        queryFilter: {},
        searchIndex: SearchIndex.DATA_ASSET,
        includeDeleted: false,
        trackTotalHits: true,
        fetchSource: false,
      });

      const buckets = res.aggregations['entityType'].buckets;
      setTreeData((origin) => {
        const updatedData = updateTreeDataWithCounts(origin, buckets);

        return updatedData.filter(
          (node) => node.totalCount !== undefined && node.totalCount > 0
        );
      });
    } catch {
      // Do nothing
    } finally {
      setIsLoading(false);
    }
  }, [searchQueryParam, setTreeData]);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchEntityCounts();
    }
  }, []);

  useEffect(() => {
    // Tree works on the quickFilter, so we need to reset the selectedKeys when the quickFilter is empty
    if (isEmpty(parsedSearch.quickFilter)) {
      setSelectedKeys([]);
    }
  }, [parsedSearch]);

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
      defaultExpandedKeys={defaultExpandedKeys}
      loadData={onLoadData}
      selectedKeys={selectedKeys}
      switcherIcon={switcherIcon}
      titleRender={(node) => (
        <ExploreTreeTitle node={node as ExploreTreeNode} />
      )}
      treeData={treeData as DataNode[]}
      onSelect={onNodeSelect}
    />
  );
};

export default ExploreTree;
