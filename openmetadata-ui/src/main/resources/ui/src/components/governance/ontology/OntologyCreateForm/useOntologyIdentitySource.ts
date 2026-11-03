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
import { useCallback } from 'react';
import { generatedOntologyIdentity } from './OntologyCreateForm.utils';
import { listOntologies } from '../../../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../../../rest/rdfAPI';
import { listAllPages } from '../../../../utils/governance/ontology/OntologyPaging.utils';

const RDF_STATUS_QUERY_KEY = 'ontology-rdf-status';
const IDENTITY_ONTOLOGIES_QUERY_KEY = 'ontology-identity-ontologies';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

/**
 * Reads the RDF base URI and the existing ontologies once, so an install or
 * an import can name the new ontology the way the create dialog does.
 */
export const useOntologyIdentitySource = (enabled = true) => {
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
    queryFn: ({ signal }) =>
      listAllPages(
        (after) => listOntologies({ after, limit: PAGE_SIZE }, signal),
        MAX_PAGES
      ),
  });
  const baseUri = status.data?.baseUri ?? '';
  const identityOf = useCallback(
    (title: string) =>
      generatedOntologyIdentity(title, baseUri, ontologies.data),
    [baseUri, ontologies.data]
  );

  const isReady = !enabled || (!status.isPending && !ontologies.isPending);

  return { identityOf, isReady };
};
