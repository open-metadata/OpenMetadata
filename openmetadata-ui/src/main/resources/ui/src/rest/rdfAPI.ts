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

import APIClient from './index';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  group: string;
  title?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  arrows?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const checkRdfEnabled = async (): Promise<boolean> => {
  try {
    const response = await APIClient.get('/rdf/status');

    return response.data?.enabled ?? false;
  } catch (error) {
    return false;
  }
};

export const fetchRdfConfig = async (): Promise<{ enabled: boolean }> => {
  const response = await APIClient.get<{ enabled: boolean }>('/rdf/status');

  return response.data;
};

export const getEntityGraphData = async (
  entityId: string,
  entityType: string,
  depth = 2
): Promise<GraphData> => {
  const response = await APIClient.get(`/rdf/graph/explore`, {
    params: {
      entityId,
      entityType,
      depth,
    },
  });

  return response.data;
};
