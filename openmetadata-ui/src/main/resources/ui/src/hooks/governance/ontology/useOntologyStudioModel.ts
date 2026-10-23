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
import { useMemo } from 'react';
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
} from '../../../rest/ontologyAPI';
import { listAllPages } from '../../../utils/governance/ontology/OntologyPaging.utils';
import {
  buildOntologyStudioGraph,
  getModelRelations,
  OntologyStudioModel,
} from '../../../utils/governance/ontology/OntologyStudioModel.utils';

export const ONTOLOGY_STUDIO_MODEL_QUERY_KEY = 'ontology-studio-model';

const PAGE_SIZE = 1000;
const MAX_DEFINITIONS = 10000;
const MAX_DEFINITION_PAGES = MAX_DEFINITIONS / PAGE_SIZE;

class AggregateCapacityError extends Error {}

// shortcut: larger catalogs require a server aggregate; users can always open one ontology.
const MAX_AGGREGATE_ONTOLOGIES = 20;
const MAX_AGGREGATE_DEFINITIONS = 2000;

const loadOntologyStudioModel = async (
  ontology: Ontology,
  signal: AbortSignal,
  consume?: (count: number) => void
): Promise<OntologyStudioModel> => {
  const loadPages: typeof listAllPages = (loadPage, maxPages) =>
    listAllPages(async (after) => {
      const page = await loadPage(after);
      consume?.(page.data.length);

      return page;
    }, maxPages);
  const params = {
    ontology: ontology.fullyQualifiedName,
    limit: PAGE_SIZE,
  };
  const [concepts, properties, axioms] = await Promise.all([
    loadPages(
      (after) =>
        listOntologyConcepts(
          {
            ...params,
            after,
            fields: 'conceptMappings,owners,subClasses,superClasses',
          },
          signal
        ),
      MAX_DEFINITION_PAGES
    ),
    loadPages(
      (after) => listOntologyProperties({ ...params, after }, signal),
      MAX_DEFINITION_PAGES
    ),
    loadPages(
      (after) =>
        listOntologyAxioms(ontology.id, { limit: PAGE_SIZE, after }, signal),
      MAX_DEFINITION_PAGES
    ),
  ]);

  return { ontology, axioms, concepts, properties };
};

export const useAllOntologyStudioModels = (
  ontologies: Ontology[],
  enabled: boolean
) => {
  const query = useQuery({
    queryKey: [
      ONTOLOGY_STUDIO_MODEL_QUERY_KEY,
      'all',
      ontologies.map(({ id }) => id),
    ],
    enabled,
    gcTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (ontologies.length > MAX_AGGREGATE_ONTOLOGIES) {
        throw new AggregateCapacityError();
      }
      let total = 0;
      for (const ontology of ontologies) {
        if (!ontology.fullyQualifiedName) {
          throw new Error('Missing ontology name');
        }
        const params = { ontology: ontology.fullyQualifiedName, limit: 1 };
        const pages = await Promise.all([
          listOntologyConcepts(params, signal),
          listOntologyProperties(params, signal),
          listOntologyAxioms(ontology.id, { limit: 1 }, signal),
        ]);
        for (const page of pages) {
          if (!Number.isFinite(page.paging.total) || page.paging.total < 0) {
            throw new Error('Missing definition count');
          }
          total += page.paging.total;
        }
        if (total > MAX_AGGREGATE_DEFINITIONS) {
          throw new AggregateCapacityError();
        }
      }
      let loaded = 0;
      const consume = (count: number) => {
        loaded += count;
        if (loaded > MAX_AGGREGATE_DEFINITIONS) {
          throw new AggregateCapacityError();
        }
      };
      const models: OntologyStudioModel[] = [];
      for (const ontology of ontologies) {
        models.push(await loadOntologyStudioModel(ontology, signal, consume));
      }

      return models;
    },
  });
  const graph = useMemo(() => {
    if (!query.data || query.isError) {
      return null;
    }
    const graphs = query.data.map((model) => buildOntologyStudioGraph(model));

    return {
      nodes: graphs.flatMap((graph) => graph.nodes),
      edges: graphs.flatMap((graph) => graph.edges),
    };
  }, [query.data, query.isError]);

  return {
    graph,
    models: query.isError ? undefined : query.data,
    isLoading: enabled && query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    isTooLarge: query.error instanceof AggregateCapacityError,
    refetch: query.refetch,
  };
};

/** Loads a native ontology's working concepts, properties and axioms as one model. */
export const useOntologyStudioModel = (ontology?: Ontology) => {
  const query = useQuery({
    queryKey: [ONTOLOGY_STUDIO_MODEL_QUERY_KEY, ontology?.id],
    enabled: Boolean(ontology),
    gcTime: 30_000,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!ontology) {
        throw new Error('Missing ontology');
      }

      return loadOntologyStudioModel(ontology, signal);
    },
  });

  const model = useMemo<OntologyStudioModel | undefined>(
    () => (ontology && query.data ? { ...query.data, ontology } : undefined),
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
