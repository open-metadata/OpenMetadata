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
import { isAxiosError } from 'axios';
import { useMemo } from 'react';
import { Ontology } from '../../../generated/entity/data/ontology';
import { OntologyAxiom } from '../../../generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../generated/entity/data/ontologyProperty';
import { MemberKind } from '../../../generated/type/ontologyReleaseMember';
import {
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
  listOntologyReleaseMembers,
} from '../../../rest/ontologyAPI';
import { listAllPages } from '../../../utils/governance/ontology/OntologyPaging.utils';
import {
  buildOntologyStudioGraph,
  getModelRelations,
  OntologyStudioModel,
  withSuperClasses,
} from '../../../utils/governance/ontology/OntologyStudioModel.utils';

export const ONTOLOGY_STUDIO_MODEL_QUERY_KEY = 'ontology-studio-model';

export const WORKING_CONCEPT_FIELDS =
  'conceptMappings,lifecycleStatus,owners,subClasses,superClasses';
const LISTED_CONCEPT_FIELDS = 'conceptMappings,lifecycleStatus,owners';

const PAGE_SIZE = 1000;
/** Mirrors the server's release member cap (`OntologyReleaseManifest.MAX_MEMBERS`). */
const MAX_DEFINITIONS = 50_000;
const MAX_DEFINITION_PAGES = MAX_DEFINITIONS / PAGE_SIZE;

class AggregateCapacityError extends Error {}

// shortcut: larger catalogs require a server aggregate; users can always open one ontology.
const MAX_AGGREGATE_ONTOLOGIES = 20;
const MAX_AGGREGATE_DEFINITIONS = 2000;

// Another session can delete an ontology between the list and its definition requests.
const skipDeleted = async <T>(load: () => Promise<T>) => {
  try {
    return await load();
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }

    throw error;
  }
};

const loadWorkingModel = async (
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
            fields: LISTED_CONCEPT_FIELDS,
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

  return {
    ontology,
    axioms,
    concepts: withSuperClasses(concepts, axioms),
    properties,
  };
};

/** Reads the definitions a sealed release froze, so a reader sees what was published. */
const loadReleaseModel = async (
  ontology: Ontology,
  releaseId: string,
  signal: AbortSignal
): Promise<OntologyStudioModel> => {
  const loadKind = async <T>(kind: MemberKind): Promise<T[]> => {
    const members = await listAllPages(
      (after) =>
        listOntologyReleaseMembers(
          releaseId,
          kind,
          { limit: PAGE_SIZE, after },
          signal
        ),
      MAX_DEFINITION_PAGES
    );

    return members.map((member) => member.payload as T);
  };
  const [concepts, properties, axioms] = await Promise.all([
    loadKind<OntologyConcept>(MemberKind.Concept),
    loadKind<OntologyProperty>(MemberKind.Property),
    loadKind<OntologyAxiom>(MemberKind.Axiom),
  ]);

  // A release payload has no `superClasses` field, so parents come from its axioms as for the draft.
  return {
    ontology,
    axioms,
    concepts: withSuperClasses(concepts, axioms),
    properties,
  };
};

const isForbidden = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 403;

/**
 * Working definitions are readable only with edit rights on the ontology. A reader without them
 * sees what the active release published, and an ontology nothing has published yet reads empty.
 */
const loadOntologyStudioModel = async (
  ontology: Ontology,
  signal: AbortSignal,
  consume?: (count: number) => void
): Promise<OntologyStudioModel> => {
  try {
    return await loadWorkingModel(ontology, signal, consume);
  } catch (error) {
    if (!isForbidden(error)) {
      throw error;
    }
    const releaseId = ontology.publicationStatus?.active?.releaseId;

    return releaseId
      ? loadReleaseModel(ontology, releaseId, signal)
      : { ontology, axioms: [], concepts: [], properties: [] };
  }
};

/** Checks the aggregate budget and returns the ontologies that still exist. */
const countAggregateOntologies = async (
  ontologies: Ontology[],
  signal: AbortSignal
) => {
  let total = 0;
  const present: Ontology[] = [];
  for (const ontology of ontologies) {
    if (!ontology.fullyQualifiedName) {
      throw new Error('Missing ontology name');
    }
    const params = { ontology: ontology.fullyQualifiedName, limit: 1 };
    const countPages = () =>
      Promise.all([
        listOntologyConcepts(params, signal),
        listOntologyProperties(params, signal),
        listOntologyAxioms(ontology.id, { limit: 1 }, signal),
      ]);
    const pages = await skipDeleted(() =>
      countPages().catch((error: unknown) => {
        if (isForbidden(error)) {
          return [];
        }

        throw error;
      })
    ); // NOSONAR sequential: the budget check stops further requests
    if (!pages) {
      continue;
    }
    present.push(ontology);
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

  return present;
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
      const present = await countAggregateOntologies(ontologies, signal);
      let loaded = 0;
      const consume = (count: number) => {
        loaded += count;
        if (loaded > MAX_AGGREGATE_DEFINITIONS) {
          throw new AggregateCapacityError();
        }
      };
      const models: OntologyStudioModel[] = [];
      for (const ontology of present) {
        const loadModel = () =>
          loadOntologyStudioModel(ontology, signal, consume);
        const model = await skipDeleted(loadModel); // NOSONAR sequential: the definition budget stops further loads
        if (model) {
          models.push(model);
        }
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

/**
 * Loads a native ontology's working concepts, properties and axioms as one model, or, given a
 * release id, the definitions that release froze.
 */
export const useOntologyStudioModel = (
  ontology?: Ontology,
  releaseId?: string
) => {
  const query = useQuery({
    queryKey: [ONTOLOGY_STUDIO_MODEL_QUERY_KEY, ontology?.id, releaseId],
    enabled: Boolean(ontology),
    gcTime: 30_000,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!ontology) {
        throw new Error('Missing ontology');
      }

      return releaseId
        ? loadReleaseModel(ontology, releaseId, signal)
        : loadOntologyStudioModel(ontology, signal);
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
