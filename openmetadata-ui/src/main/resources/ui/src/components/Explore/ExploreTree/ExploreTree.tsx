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
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import React, { useCallback, useState } from 'react';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EsBoolQuery } from '../../../pages/ExplorePage/ExplorePage.interface';
import { getAggregateFieldOptions } from '../../../rest/miscAPI';
import { getCountBadge } from '../../../utils/CommonUtils';
import { getEntityNameLabel } from '../../../utils/EntityUtils';
import { getAggregations } from '../../../utils/Explore.utils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getEntityIcon } from '../../../utils/TableUtils';
import {
  DatabaseFields,
  ExploreTreeNode,
  ExploreTreeProps,
  TreeNodeData,
} from './ExploreTree.interface';

const ExploreTree = ({ onFieldValueSelect }: ExploreTreeProps) => {
  const initTreeData = searchClassBase.getExploreTree();
  const [treeData, setTreeData] = useState(initTreeData);

  const getSubLevelHierarchyKey = (
    isDatabaseHierarchy = false,
    key?: EntityFields,
    value?: string
  ) => {
    const queryFilter = {
      query: { bool: {} },
    };

    if (key && value) {
      (queryFilter.query.bool as EsBoolQuery).must = { term: { [key]: value } };
    }

    const bucketMapping = isDatabaseHierarchy
      ? {
          [EntityFields.SERVICE_TYPE]: EntityFields.SERVICE,
          [EntityFields.SERVICE]: EntityFields.DATABASE,
          [EntityFields.DATABASE]: EntityFields.DATABASE_SCHEMA,
          [EntityFields.DATABASE_SCHEMA]: EntityFields.ENTITY_TYPE,
        }
      : {
          [EntityFields.SERVICE_TYPE]: EntityFields.SERVICE,
          [EntityFields.SERVICE]: EntityFields.ENTITY_TYPE,
        };

    return {
      bucket: bucketMapping[key as DatabaseFields] ?? EntityFields.SERVICE_TYPE,
      queryFilter,
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
        rootIndex,
      } = treeNode?.data as TreeNodeData;

      const searchIndex = isRoot
        ? treeNode.key
        : treeNode?.data?.parentSearchIndex;

      const { bucket: bucketToFind, queryFilter } = getSubLevelHierarchyKey(
        rootIndex === SearchIndex.DATABASE,
        currentBucketKey as EntityFields,
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
            isRoot: false,
            rootIndex: isRoot ? treeNode.key : treeNode.data?.rootIndex,
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
      } else if (node.isLeaf) {
        const filterField = [
          {
            label: EntityFields.ENTITY_TYPE,
            key: EntityFields.ENTITY_TYPE,
            value: [
              {
                key: node.data?.entityType,
                label: node.data?.entityType,
              },
            ],
          },
        ];
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
      titleRender={(node) => (
        <Typography.Text
          className={classNames({
            'm-l-xs': node.data?.isRoot,
          })}>
          {node.title}
        </Typography.Text>
      )}
      treeData={treeData}
      onSelect={onNodeSelect}
    />
  );
};

export default ExploreTree;
