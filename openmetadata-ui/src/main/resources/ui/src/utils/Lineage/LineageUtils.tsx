/*
 *  Copyright 2025 Collate.
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
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { get, omit, pick } from 'lodash';
import {
  ColumnLevelLineageNode,
  EdgeDetails,
} from '../../components/Lineage/Lineage.interface';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { QueryFieldInterface } from '../../pages/ExplorePage/ExplorePage.interface';

import { ReactComponent as ColumnIcon } from '../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/ic-table.svg';
import {
  EImpactLevel,
  LineageNodeData,
} from '../../components/LineageTable/LineageTable.interface';
import { TableSearchSource } from '../../interface/search.interface';
import i18n from '../i18next/LocalUtil';

export const LINEAGE_IMPACT_OPTIONS = [
  {
    label: i18n.t('label.table-level'),
    key: EImpactLevel.TableLevel,
    icon: <TableIcon />,
  },
  {
    label: i18n.t('label.column-level'),
    key: EImpactLevel.ColumnLevel,
    icon: <ColumnIcon />,
  },
];

export const LINEAGE_DEPENDENCY_OPTIONS = [
  {
    label: 'Direct',
    key: 'direct',
    icon: <ArrowRightOutlined />,
  },
  {
    label: 'Indirect',
    key: 'indirect',
    icon: <ArrowLeftOutlined />,
  },
];

export const prepareColumnLevelNodesFromEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, LineageNodeData>,
  direction: LineageDirection = LineageDirection.Downstream
) => {
  const entityKey =
    direction === LineageDirection.Upstream ? 'fromEntity' : 'toEntity';

  return edges.reduce((acc: ColumnLevelLineageNode[], node: EdgeDetails) => {
    if (node.columns?.length ?? 0 > 0) {
      node.columns?.forEach((col) => {
        const entityData = get(
          nodes[node[entityKey].fullyQualifiedName ?? ''],
          'entity'
        );
        const nodeDepth = get(
          nodes[node[entityKey].fullyQualifiedName ?? ''],
          'nodeDepth',
          0
        );

        const picked = pick<LineageNodeData['entity']>(
          entityData,
          'owners',
          'tier',
          'tags',
          'domains',
          'description'
        ) as Pick<
          TableSearchSource,
          'tags' | 'tier' | 'domains' | 'description' | 'owners' | 'id'
        >; // Type assertion to Include type to ensure only these fields are

        acc.push({
          ...omit(node, 'columns'),
          column: col,
          nodeDepth,
          ...picked,
        });
      });
    }

    return acc;
  }, []);
};

export const prepareDownstreamColumnLevelNodesFromDownstreamEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, LineageNodeData>
) => {
  return prepareColumnLevelNodesFromEdges(
    edges,
    nodes,
    LineageDirection.Downstream
  );
};

export const prepareUpstreamColumnLevelNodesFromUpstreamEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, LineageNodeData>
) => {
  return prepareColumnLevelNodesFromEdges(
    edges,
    nodes,
    LineageDirection.Upstream
  );
};

export const getSearchNameEsQuery = (
  searchText: string
): QueryFieldInterface => {
  return {
    bool: {
      should: [
        {
          wildcard: {
            'name.keyword': {
              value: `*${searchText}*`,
            },
          },
        },
        {
          wildcard: {
            'displayName.keyword': {
              value: `*${searchText}*`,
            },
          },
        },
      ],
    },
  };
};
