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
import { useQuery } from '@tanstack/react-query';
import { PagingResponse } from 'Models';
import { useMemo } from 'react';
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
} from '../../../rest/ontologyAPI';
import {
  buildOntologyStudioGraph,
  getModelRelations,
  OntologyStudioModel,
} from '../../../utils/governance/ontology/OntologyStudioModel.utils';

export const ONTOLOGY_STUDIO_MODEL_QUERY_KEY = 'ontology-studio-model';

const PAGE_SIZE = 1000;
const MAX_DEFINITIONS = 10000;
const MAX_DEFINITION_PAGES = MAX_DEFINITIONS / PAGE_SIZE;

const listAllPages = async <T>(
  loadPage: (after?: string) => Promise<PagingResponse<T[]>>
): Promise<T[]> => {
  const items: T[] = [];
  const cursors = new Set<string>();
  let after: string | undefined;

  for (let pageNumber = 0; pageNumber < MAX_DEFINITION_PAGES; pageNumber++) {
    const page = await loadPage(after);
    items.push(...page.data);

    const next = page.paging.after;
    if (!next) {
      return items;
    }
    if (cursors.has(next)) {
      throw new Error('Ontology model pagination returned a repeated cursor');
    }
    cursors.add(next);
    after = next;
  }

  // shortcut: each definition type is capped; add server-side graph paging before raising it.
  throw new Error('Ontology model exceeds the definition loading limit');
};

/** Loads a native ontology's working concepts, properties and axioms as one model. */
export const useOntologyStudioModel = (ontology?: Ontology) => {
  const query = useQuery({
    queryKey: [ONTOLOGY_STUDIO_MODEL_QUERY_KEY, ontology?.id],
    enabled: Boolean(ontology),
    gcTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!ontology) {
        throw new Error('Missing ontology');
      }
      const params = {
        ontology: ontology.fullyQualifiedName,
        limit: PAGE_SIZE,
      };
      const [concepts, properties, axioms] = await Promise.all([
        listAllPages((after) =>
          listOntologyConcepts(
            {
              ...params,
              after,
              fields: 'conceptMappings,owners,subClasses,superClasses',
            },
            signal
          )
        ),
        listAllPages((after) =>
          listOntologyProperties({ ...params, after }, signal)
        ),
        listAllPages((after) =>
          listOntologyAxioms(ontology.id, { limit: PAGE_SIZE, after }, signal)
        ),
      ]);

      return { axioms, concepts, properties };
    },
  });

  const model = useMemo<OntologyStudioModel | undefined>(
    () => (ontology && query.data ? { ontology, ...query.data } : undefined),
    [ontology, query.data]
  );
  const relations = useMemo(
    () => (model ? getModelRelations(model) : []),
    [model]
  );
  const graph = useMemo(
    () => (model ? buildOntologyStudioGraph(model, relations) : null),
    [model, relations]
  );

  return {
    graph,
    isError: query.isError,
    isFetching: query.isFetching,
    isLoading: query.isPending && Boolean(ontology),
    model,
    refetch: query.refetch,
    relations,
  };
};
