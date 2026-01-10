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
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { get, omit, pick } from 'lodash';
import { ReactComponent as ColumnIcon } from '../../assets/svg/ic-column-new.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/ic-table-new.svg';
import { CondensedBreadcrumb } from '../../components/CondensedBreadcrumb/CondensedBreadcrumb.component';
import {
  ColumnLevelLineageNode,
  EdgeDetails,
  NodeData,
} from '../../components/Lineage/Lineage.interface';
import { EImpactLevel } from '../../components/LineageTable/LineageTable.interface';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { TableSearchSource } from '../../interface/search.interface';
import { QueryFieldInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import i18n from '../i18next/LocalUtil';

export const LINEAGE_IMPACT_OPTIONS = [
  {
    label: i18n.t('label.asset-level'),
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
  nodes: Record<string, NodeData>,
  direction: LineageDirection = LineageDirection.Downstream
) => {
  const entityKey =
    direction === LineageDirection.Upstream ? 'fromEntity' : 'toEntity';

  return edges.reduce((acc: ColumnLevelLineageNode[], node: EdgeDetails) => {
    if ((node.columns?.length ?? 0) > 0) {
      for (const col of node.columns ?? []) {
        const entityData = get(
          nodes[node[entityKey].fullyQualifiedName ?? ''],
          'entity'
        );
        const nodeDepth = get(
          nodes[node[entityKey].fullyQualifiedName ?? ''],
          'nodeDepth',
          0
        );

        if (!entityData) {
          continue;
        }

        const picked = pick<NodeData['entity']>(
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

        // flatten the fromColumns to create separate nodes for each
        for (const fromCol of col.fromColumns || []) {
          acc.push({
            ...omit(node, 'columns'),
            column: { ...col, fromColumns: [fromCol] },
            docId: fromCol + '->' + col.toColumn,
            nodeDepth,
            ...picked,
          });
        }
      }
    }

    return acc;
  }, []);
};

export const prepareDownstreamColumnLevelNodesFromDownstreamEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, NodeData>
) => {
  return prepareColumnLevelNodesFromEdges(
    edges,
    nodes,
    LineageDirection.Downstream
  );
};

export const prepareUpstreamColumnLevelNodesFromUpstreamEdges = (
  edges: EdgeDetails[],
  nodes: Record<string, NodeData>
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
            ['name.keyword']: {
              value: `*${searchText}*`,
            },
          },
        },
        {
          wildcard: {
            ['displayName.keyword']: {
              value: `*${searchText}*`,
            },
          },
        },
      ],
    },
  };
};

export const getTruncatedPath = (path: string, className?: string) => {
  if (!path) {
    return path;
  }

  const parts = path.split('>');

  return (
    <CondensedBreadcrumb
      className={className}
      items={parts}
      separator={<ChevronRightIcon className="right-arrow-icon" />}
    />
  );
};
