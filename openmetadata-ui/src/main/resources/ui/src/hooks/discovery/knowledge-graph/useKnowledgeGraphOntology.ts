/*
 *  Copyright 2026 Collate.
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

import { useMemo, useState } from 'react';
import {
  GraphData,
  KnowledgeGraphFilters,
  KnowledgeGraphLevel,
  KnowledgeGraphMode,
} from '../../../interface/discovery/knowledge-graph.interface';
import { graphLevelToDepth } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import {
  getOntologyScope,
  graphEntityId,
} from '../../../utils/discovery/knowledge-graph/knowledgeGraphOntology.utils';
import { isConceptNode } from '../../../utils/discovery/knowledge-graph/knowledgeGraphPresentation.utils';
import { useKnowledgeGraphData } from './useKnowledgeGraphData';

export const useKnowledgeGraphOntology = (
  assetGraph: GraphData | null,
  mode: KnowledgeGraphMode,
  level: KnowledgeGraphLevel,
  filters: KnowledgeGraphFilters,
  refresh: number
) => {
  const concepts = useMemo(
    () =>
      (assetGraph?.nodes ?? [])
        .filter(isConceptNode)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [assetGraph]
  );
  const [chosen, setChosen] = useState<string>();
  const concept = concepts.find((node) => node.id === chosen) ?? concepts[0];
  const query = useMemo(
    () => ({
      entityId: mode === 'ontology' && concept ? graphEntityId(concept.id) : '',
      entityType: 'glossaryTerm',
      depth: graphLevelToDepth(level),
      entityTypes: filters.entityTypes,
      relationshipTypes: filters.relationshipTypes,
    }),
    [mode, concept, level, filters]
  );
  const result = useKnowledgeGraphData(query, refresh);
  const data = useMemo(
    () => getOntologyScope(result.data, concept?.id ?? ''),
    [result.data, concept?.id]
  );
  const unfiltered = useMemo(
    () => getOntologyScope(result.unfiltered, concept?.id ?? ''),
    [result.unfiltered, concept?.id]
  );

  return {
    ...result,
    data,
    unfiltered,
    concepts,
    concept,
    onConceptChange: setChosen,
  };
};
