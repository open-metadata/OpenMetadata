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
import { Tree, TreeDataNode, Typography } from 'antd';
import { uniqueId } from 'lodash';
import React, { useState } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getCountBadge } from '../../../utils/CommonUtils';
import { getEntityNameLabel } from '../../../utils/EntityUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getEntityIcon } from '../../../utils/TableUtils';
import { ExploreSearchIndex } from '../ExplorePage.interface';

// const TreeHeadingKeys = {
//   DATABASE: 'TH_Database',
//   DASHBOARD: 'TH_Dashboard',
//   GOVERN: 'TH_Govern',
// };

const initTreeData: TreeDataNode[] = [
  {
    title: 'Databases',
    key: SearchIndex.DATABASE,
  },
  { title: 'Dashboards', key: SearchIndex.DASHBOARD },
  { title: 'Pipelines', key: SearchIndex.PIPELINE },
  { title: 'Topics', key: SearchIndex.TOPIC },
  { title: 'Ml Models', key: SearchIndex.MLMODEL },
  {
    title: 'Govern',
    key: 'Govern',
    children: [
      { title: 'Glossary', key: '3', isLeaf: true },
      { title: 'Classification', key: '4', isLeaf: true },
    ],
  },
];

const ExploreTree = () => {
  const [treeData, setTreeData] = useState(initTreeData);

  const updateTreeData = (
    list: TreeDataNode[],
    key: React.Key,
    children: TreeDataNode[]
  ): TreeDataNode[] =>
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
    });

  const onLoadData = async (treeNode: TreeDataNode) => {
    if (treeNode.children) {
      return;
    }

    const serviceType = treeNode?.data?.serviceType;
    const searchIndex = serviceType ? SearchIndex.ALL : treeNode.key;
    // const bucketCount = treeNode?.data?.count;
    const queryFilter = { query: { bool: {} } };
    if (serviceType) {
      queryFilter.query.bool = {
        must: [
          {
            term: {
              serviceType: serviceType,
            },
          },
        ],
      };
    }

    const res = await searchQuery({
      query: '',
      pageNumber: 0,
      pageSize: 0,
      queryFilter: queryFilter,
      searchIndex: searchIndex as ExploreSearchIndex,
      includeDeleted: false,
      trackTotalHits: true,
      fetchSource: false,
      filters: '',
    });
    const bucketToFind = serviceType ? 'entityType' : 'serviceType';
    const buckets = res.aggregations[bucketToFind].buckets;
    const sortedBuckets = [...buckets].sort((a, b) =>
      a.key.localeCompare(b.key, undefined, { sensitivity: 'base' })
    );
    const children = sortedBuckets.map((bucket) => {
      let logo: JSX.Element;
      const title = (
        <div className="d-flex justify-between">
          <Typography.Text className="m-l-xs">
            {getEntityNameLabel(bucket.key)}
          </Typography.Text>
          {serviceType && <span>{getCountBadge(bucket.doc_count)}</span>}
        </div>
      );
      if (serviceType) {
        logo = getEntityIcon(bucket.key, 'service-icon w-4 h-4');
      } else {
        const serviceIcon = serviceUtilClassBase.getLogoFromServiceType(
          bucket.key
        );
        logo = (
          <img alt="logo" src={serviceIcon} style={{ width: 18, height: 18 }} />
        );
      }

      return {
        title: title,
        key: uniqueId(),
        icon: logo,
        isLeaf: serviceType,
        data: {
          isService: true,
          serviceType: bucket.key,
          //   count: bucket.doc_count,
        },
      };
    });

    setTreeData((origin) => updateTreeData(origin, treeNode.key, children));
  };

  return (
    <Tree
      blockNode
      showIcon
      className="p-x-sm"
      loadData={onLoadData}
      treeData={treeData}
    />
  );
};

export default ExploreTree;
