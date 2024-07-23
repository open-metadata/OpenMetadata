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
import { Tree, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isString, uniqueId } from 'lodash';
import Qs from 'qs';
import React, { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { ExplorePageTabs } from '../../../enums/Explore.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getCountBadge } from '../../../utils/CommonUtils';
import { getEntityNameLabel } from '../../../utils/EntityUtils';
import {
  getAggregations,
  getQuickFilterObject,
  getSubLevelHierarchyKey,
  updateTreeData,
} from '../../../utils/ExploreUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getEntityIcon } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { UrlParams } from '../ExplorePage.interface';
import {
  ExploreTreeNode,
  ExploreTreeProps,
  TreeNodeData,
} from './ExploreTree.interface';

const ExploreTreeTitle = ({ node }: { node: ExploreTreeNode }) => (
  <Typography.Text
    className={classNames({
      'm-l-xss': node.data?.isRoot || node.data?.isStatic,
    })}
    data-testid={`explore-tree-title-${node.data?.dataId}`}>
    {node.title}
  </Typography.Text>
);

const ExploreTree = ({ onFieldValueSelect }: ExploreTreeProps) => {
  const { tab } = useParams<UrlParams>();
  const initTreeData = searchClassBase.getExploreTree();
  const [treeData, setTreeData] = useState(initTreeData);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const defaultExpandedKeys = useMemo(() => {
    return searchClassBase.getExploreTreeKey(tab as ExplorePageTabs);
  }, [tab]);

  const [searchQueryParam, defaultServiceType] = useMemo(() => {
    const parsedSearch = Qs.parse(
      location.search.startsWith('?')
        ? location.search.substring(1)
        : location.search
    );

    const defaultServiceType = parsedSearch.defaultServiceType;

    const searchQueryParam = isString(parsedSearch.search)
      ? parsedSearch.search
      : '';

    return [searchQueryParam, defaultServiceType];
  }, [location.search]);

  const onLoadData = useCallback(
    async (treeNode: ExploreTreeNode) => {
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
        } = treeNode?.data as TreeNodeData;

        const searchIndex = isRoot
          ? treeNode.key
          : treeNode?.data?.parentSearchIndex;

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
        const buckets = aggregations[bucketToFind].buckets;
        const isServiceType = bucketToFind === EntityFields.SERVICE_TYPE;
        const isEntityType = bucketToFind === EntityFields.ENTITY_TYPE;

        const sortedBuckets = buckets.sort((a, b) =>
          a.key.localeCompare(b.key, undefined, { sensitivity: 'base' })
        );

        const children = sortedBuckets.map((bucket) => {
          const id = uniqueId();

          let logo = undefined;
          if (isEntityType) {
            logo = getEntityIcon(bucket.key, 'service-icon w-4 h-4') ?? <></>;
          } else if (isServiceType) {
            const serviceIcon = serviceUtilClassBase.getServiceLogo(bucket.key);
            logo = (
              <img
                alt="logo"
                src={serviceIcon}
                style={{ width: 18, height: 18 }}
              />
            );
          }

          if (bucket.key.toLowerCase() === defaultServiceType) {
            setSelectedKeys([id]);
          }

          const title = (
            <div className="d-flex justify-between">
              <Typography.Text
                className={classNames({
                  'm-l-xss': !logo,
                })}>
                {isEntityType ? getEntityNameLabel(bucket.key) : bucket.key}
              </Typography.Text>
              {isEntityType && <span>{getCountBadge(bucket.doc_count)}</span>}
            </div>
          );

          return {
            title: title,
            key: id,
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
              rootIndex: treeNode.data?.rootIndex,
              dataId: bucket.key,
            },
          };
        });

        setTreeData((origin) => updateTreeData(origin, treeNode.key, children));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [updateTreeData, searchQueryParam, defaultServiceType]
  );

  const switcherIcon = useCallback(({ expanded }) => {
    return expanded ? <IconDown /> : <IconRight />;
  }, []);

  const onNodeSelect = useCallback(
    (_, { node }) => {
      const filterField = node.data?.filterField;
      if (filterField) {
        onFieldValueSelect(filterField);
      } else if (node.isLeaf) {
        const filterField = [
          getQuickFilterObject(EntityFields.ENTITY_TYPE, node.data?.entityType),
        ];
        onFieldValueSelect(filterField);
      }
      setSelectedKeys([node.key]);
    },
    [onFieldValueSelect]
  );

  return (
    <Tree
      blockNode
      showIcon
      className="explore-tree p-sm p-t-0"
      data-testid="explore-tree"
      defaultExpandedKeys={defaultExpandedKeys}
      loadData={onLoadData}
      selectedKeys={selectedKeys}
      switcherIcon={switcherIcon}
      titleRender={(node) => <ExploreTreeTitle node={node} />}
      treeData={treeData}
      onSelect={onNodeSelect}
    />
  );
};

export default ExploreTree;
