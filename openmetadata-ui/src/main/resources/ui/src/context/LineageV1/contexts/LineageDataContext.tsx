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

import { createContext, ReactNode, useMemo } from 'react';
import { Edge, Node } from 'reactflow';
import { LineageConfig } from '../../../components/Entity/EntityLineage/EntityLineage.interface';
import { EntityLineageResponse } from '../../../components/Lineage/Lineage.interface';
import { LineageDataContextType } from '../LineageProviderV1.interface';

export const LineageDataContext = createContext<LineageDataContextType>({
  nodes: [],
  edges: [],
  entityLineage: {
    nodes: [],
    edges: [],
    entity: {} as any,
  },
  lineageConfig: {
    upstreamDepth: 3,
    downstreamDepth: 3,
    nodesPerLayer: 50,
  },
  tracedNodes: [],
  tracedColumns: [],
  columnsHavingLineage: [],
});

interface LineageDataProviderProps {
  children: ReactNode;
  nodes: Node[];
  edges: Edge[];
  entityLineage: EntityLineageResponse;
  lineageConfig: LineageConfig;
  tracedNodes: string[];
  tracedColumns: string[];
  columnsHavingLineage: string[];
  dataQualityLineage?: EntityLineageResponse;
  dqHighlightedEdges?: Set<string>;
}

export const LineageDataProvider = ({
  children,
  nodes,
  edges,
  entityLineage,
  lineageConfig,
  tracedNodes,
  tracedColumns,
  columnsHavingLineage,
  dataQualityLineage,
  dqHighlightedEdges,
}: LineageDataProviderProps) => {
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      nodes,
      edges,
      entityLineage,
      lineageConfig,
      tracedNodes,
      tracedColumns,
      columnsHavingLineage,
      dataQualityLineage,
      dqHighlightedEdges,
    }),
    [
      nodes,
      edges,
      entityLineage,
      lineageConfig,
      tracedNodes,
      tracedColumns,
      columnsHavingLineage,
      dataQualityLineage,
      dqHighlightedEdges,
    ]
  );

  return (
    <LineageDataContext.Provider value={value}>
      {children}
    </LineageDataContext.Provider>
  );
};
