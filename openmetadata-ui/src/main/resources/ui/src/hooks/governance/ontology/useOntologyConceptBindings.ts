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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { UpdateOntologyConceptBinding } from '../../../generated/api/data/updateOntologyConceptBinding';
import {
  deleteOntologyConceptBinding,
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../rest/ontologyAPI';
import { showErrorToast } from '../../../utils/ToastUtils';

const ONTOLOGY_CONCEPT_BINDINGS_QUERY_KEY = 'ontology-concept-bindings';

export const useOntologyConceptBindings = (conceptId?: string) => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [ONTOLOGY_CONCEPT_BINDINGS_QUERY_KEY, conceptId],
    enabled: Boolean(conceptId),
    gcTime: 30_000,
    staleTime: 30_000,
    retry: false,
    queryFn: ({ signal }) => {
      if (!conceptId) {
        throw new Error('Missing ontology concept');
      }

      return getOntologyConceptBindings(conceptId, signal);
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      request,
    }: {
      id: string;
      request: UpdateOntologyConceptBinding;
    }) => putOntologyConceptBinding(id, request),
    onSuccess: (data, { id }) =>
      client.setQueryData([ONTOLOGY_CONCEPT_BINDINGS_QUERY_KEY, id], data),
    onError: (error, { id }) => {
      showErrorToast(isAxiosError(error) ? error : error.message);
      void client.invalidateQueries({
        queryKey: [ONTOLOGY_CONCEPT_BINDINGS_QUERY_KEY, id],
      });
    },
  });
  const remove = useMutation({
    mutationFn: ({
      id,
      assetType,
      assetId,
      revision,
    }: {
      id: string;
      assetType: string;
      assetId: string;
      revision: number;
    }) => deleteOntologyConceptBinding(id, assetType, assetId, revision),
    onSuccess: (data, { id }) =>
      client.setQueryData([ONTOLOGY_CONCEPT_BINDINGS_QUERY_KEY, id], data),
    onError: (error, { id }) => {
      showErrorToast(isAxiosError(error) ? error : error.message);
      void client.invalidateQueries({
        queryKey: [ONTOLOGY_CONCEPT_BINDINGS_QUERY_KEY, id],
      });
    },
  });

  return { ...query, update, remove };
};
