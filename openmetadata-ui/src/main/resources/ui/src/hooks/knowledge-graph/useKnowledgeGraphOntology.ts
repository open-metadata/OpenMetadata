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

import { useEffect, useMemo, useState } from 'react';
import {
  GraphData,
  GraphNode,
  KnowledgeGraphFilters,
  KnowledgeGraphLevel,
  KnowledgeGraphMode,
} from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { getGlossaryTermsByIds } from '../../rest/glossaryAPI';
import {
  getOntologyScope,
  graphEntityId,
} from '../../utils/knowledge-graph/knowledgeGraphOntology.utils';
import { isConceptNode } from '../../utils/knowledge-graph/knowledgeGraphPresentation.utils';
import { graphLevelToDepth } from '../../utils/KnowledgeGraph.utils';
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

const EMPTY_TERMS: GlossaryTerm[] = [];

export const useKnowledgeGraphConceptDetails = (
  nodes: GraphNode[],
  enabled: boolean,
  refresh: number
) => {
  const idsKey = JSON.stringify(
    enabled
      ? nodes
          .filter(isConceptNode)
          .map((node) => graphEntityId(node.id))
          .sort()
      : []
  );
  const [state, setState] = useState<{
    key: string;
    terms: GlossaryTerm[];
    loading: boolean;
    partial: boolean;
    error: unknown;
  }>({ key: '', terms: [], loading: false, partial: false, error: null });
  useEffect(() => {
    const controller = new AbortController();
    const ids = JSON.parse(idsKey) as string[];
    if (!ids.length) {
      return () => controller.abort();
    }
    setState((previous) => ({
      key: idsKey,
      terms: previous.key === idsKey ? previous.terms : [],
      loading: true,
      partial: false,
      error: null,
    }));
    const fetchTerms = async () => {
      const terms: GlossaryTerm[] = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const next = await getGlossaryTermsByIds(
          ids.slice(offset, offset + 100),
          {
            fields: 'attributes,effectiveAttributes',
          },
          controller.signal
        );
        if (controller.signal.aborted) {
          return;
        }
        terms.push(...next);
      }
      setState({
        key: idsKey,
        terms,
        loading: false,
        partial: terms.length !== ids.length,
        error: null,
      });
    };
    void fetchTerms().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setState((previous) => ({
          key: idsKey,
          terms: previous.key === idsKey ? previous.terms : [],
          loading: false,
          partial: false,
          error,
        }));
      }
    });

    return () => controller.abort();
  }, [idsKey, refresh]);

  return state.key === idsKey
    ? state
    : {
        ...state,
        terms: EMPTY_TERMS,
        loading: enabled && idsKey !== '[]',
        error: null,
      };
};
