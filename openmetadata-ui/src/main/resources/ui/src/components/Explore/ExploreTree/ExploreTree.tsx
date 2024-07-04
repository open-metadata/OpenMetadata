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
import { isUndefined, uniqueId } from 'lodash';
import React, { useCallback, useState } from 'react';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { getAggregateFieldOptions } from '../../../rest/miscAPI';
import { getCountBadge } from '../../../utils/CommonUtils';
import { getEntityNameLabel } from '../../../utils/EntityUtils';
import { getAggregations } from '../../../utils/Explore.utils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getEntityIcon } from '../../../utils/TableUtils';
import { ExploreQuickFilterField } from '../ExplorePage.interface';

type ExploreTreeNode = {
  title: string | JSX.Element;
  key: string;
  children?: ExploreTreeNode[];
  isLeaf?: boolean;
  icon?: JSX.Element;
  data?: Record<string | number, any>;
};

type ExploreTreeProps = {
  onFieldValueSelect: (field: ExploreQuickFilterField[]) => void;
};

const ExploreTree = ({ onFieldValueSelect }: ExploreTreeProps) => {
  const initTreeData: ExploreTreeNode[] = [
    {
      title: 'Databases',
      key: SearchIndex.DATABASE,
      data: { isRoot: true },
    },
    { title: 'Dashboards', key: SearchIndex.DASHBOARD, data: { isRoot: true } },
    { title: 'Pipelines', key: SearchIndex.PIPELINE, data: { isRoot: true } },
    { title: 'Topics', key: SearchIndex.TOPIC, data: { isRoot: true } },
    { title: 'Ml Models', key: SearchIndex.MLMODEL, data: { isRoot: true } },
    { title: 'Containers', key: SearchIndex.CONTAINER, data: { isRoot: true } },
    {
      title: 'Search Indexes',
      key: SearchIndex.SEARCH_INDEX,
      data: { isRoot: true },
    },
    {
      title: 'Govern',
      key: 'Govern',
      children: [
        { title: 'Glossary', key: '3', isLeaf: true },
        { title: 'Classification', key: '4', isLeaf: true },
      ],
    },
  ];
  const [treeData, setTreeData] = useState(initTreeData);

  const getSubLevelHierarchyKey = (key?: string, value?: string) => {
    if (isUndefined(key)) {
      return {
        bucket: EntityFields.SERVICE_TYPE,
        queryFilter: {
          query: { bool: {} },
        },
      };
    }

    if (key === EntityFields.SERVICE_TYPE) {
      return {
        bucket: EntityFields.SERVICE,
        queryFilter: {
          query: { bool: { must: { term: { [key]: value } } } },
        },
      };
    }

    if (key === EntityFields.SERVICE) {
      return {
        bucket: EntityFields.ENTITY_TYPE,
        queryFilter: {
          query: { bool: { must: { term: { [key]: value } } } },
        },
      };
    }

    return {
      bucket: EntityFields.SERVICE_TYPE,
      queryFilter: {
        query: { bool: { must: { term: { [key]: value } } } },
      },
    };
  };

  const updateTreeData = useCallback(
    (
      list: ExploreTreeNode[],
      key: React.Key,
      children: ExploreTreeNode[]
    ): ExploreTreeNode[] =>
      list.map((node) => {
        if (node.key === key) {
          return {
            ...node,
            children,
          };
        }
        if (node.children) {
          return {
            ...node,
            children: updateTreeData(node.children, key, children),
          };
        }

        return node;
      }),
    []
  );

  const onLoadData = useCallback(
    async (treeNode: ExploreTreeNode) => {
      if (treeNode.children) {
        return;
      }

      const {
        isRoot = false,
        currentBucketKey,
        currentBucketValue,
        filterField = [],
      } = treeNode?.data;

      const searchIndex = isRoot
        ? treeNode.key
        : treeNode?.data?.parentSearchIndex;

      const { bucket: bucketToFind, queryFilter } = getSubLevelHierarchyKey(
        currentBucketKey,
        currentBucketValue
      );

      const res = await getAggregateFieldOptions(
        searchIndex as SearchIndex,
        bucketToFind,
        '',
        JSON.stringify(queryFilter)
      );
      const aggregations = getAggregations(res.data.aggregations);
      const buckets = aggregations[bucketToFind].buckets;
      const isServiceType = bucketToFind === EntityFields.SERVICE_TYPE;
      const isEntityType = bucketToFind === EntityFields.ENTITY_TYPE;

      const sortedBuckets = [...buckets].sort((a, b) =>
        a.key.localeCompare(b.key, undefined, { sensitivity: 'base' })
      );
      const children = sortedBuckets.map((bucket) => {
        let logo = <></>;
        const title = (
          <div className="d-flex justify-between">
            <Typography.Text className="m-l-xs">
              {isEntityType ? getEntityNameLabel(bucket.key) : bucket.key}
            </Typography.Text>
            {isEntityType && <span>{getCountBadge(bucket.doc_count)}</span>}
          </div>
        );
        if (isEntityType) {
          logo = getEntityIcon(bucket.key, 'service-icon w-4 h-4');
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

        return {
          title: title,
          key: uniqueId(),
          icon: logo,
          isLeaf: bucketToFind === EntityFields.ENTITY_TYPE,
          data: {
            currentBucketKey: bucketToFind,
            parentSearchIndex: isRoot ? treeNode.key : SearchIndex.DATA_ASSET,
            currentBucketValue: bucket.key,
            filterField: [
              ...filterField,
              {
                label: bucketToFind,
                key: bucketToFind,
                value: [
                  {
                    key: bucket.key,
                    label: bucket.key,
                  },
                ],
              },
            ],
          },
        };
      });

      setTreeData((origin) => updateTreeData(origin, treeNode.key, children));
    },
    [updateTreeData]
  );

  const onNodeSelect = useCallback(
    (_, { node }) => {
      const filterField = node.data?.filterField;
      if (filterField) {
        onFieldValueSelect(filterField);
      }
    },
    [onFieldValueSelect]
  );

  return (
    <Tree
      blockNode
      showIcon
      className="p-x-sm"
      loadData={onLoadData}
      treeData={treeData}
      onSelect={onNodeSelect}
    />
  );
};

export default ExploreTree;
