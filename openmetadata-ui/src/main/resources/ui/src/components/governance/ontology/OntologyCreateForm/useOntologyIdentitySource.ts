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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Include } from '../../../../generated/type/include';
import { listOntologies } from '../../../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../../../rest/rdfAPI';
import { listAllPages } from '../../../../utils/governance/ontology/OntologyPaging.utils';
import { generatedOntologyIdentity } from './OntologyCreateForm.utils';

const RDF_STATUS_QUERY_KEY = 'ontology-rdf-status';
const IDENTITY_ONTOLOGIES_QUERY_KEY = 'ontology-identity-ontologies';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

// A soft-deleted ontology still holds its name, so the listing must include it.
const listIdentityOntologies = (signal?: AbortSignal) =>
  listAllPages(
    (after) =>
      listOntologies({ after, limit: PAGE_SIZE, include: Include.All }, signal),
    MAX_PAGES
  );

/**
 * Reads the RDF base URI and the existing ontologies once, so an install or
 * an import can name the new ontology the way the create dialog does.
 */
export const useOntologyIdentitySource = (enabled = true) => {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: [RDF_STATUS_QUERY_KEY],
    queryFn: fetchRdfConfig,
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const ontologies = useQuery({
    queryKey: [IDENTITY_ONTOLOGIES_QUERY_KEY],
    enabled,
    gcTime: 30_000,
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) => listIdentityOntologies(signal),
  });
  const baseUri = status.data?.baseUri ?? '';
  const identityOf = useCallback(
    (title: string) =>
      generatedOntologyIdentity(title, baseUri, ontologies.data),
    [baseUri, ontologies.data]
  );

  // The panel can sit open while someone else takes a name, so the create
  // reads the names again instead of trusting the list from when it opened.
  const refreshIdentityOf = useCallback(async () => {
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: [IDENTITY_ONTOLOGIES_QUERY_KEY],
        queryFn: ({ signal }) => listIdentityOntologies(signal),
        staleTime: 0,
      });

      return (title: string) =>
        generatedOntologyIdentity(title, baseUri, fresh);
    } catch {
      return identityOf;
    }
  }, [baseUri, identityOf, queryClient]);

  const isReady = !enabled || (!status.isPending && !ontologies.isPending);

  return { identityOf, refreshIdentityOf, isReady };
};
