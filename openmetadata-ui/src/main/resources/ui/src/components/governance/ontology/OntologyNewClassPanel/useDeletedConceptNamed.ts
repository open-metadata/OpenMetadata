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
import { useEffect, useState } from 'react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { getOntologyConceptByName } from '../../../../rest/ontologyAPI';
import { OntologyStudioModel } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { isValidLocalName } from './OntologyNewClassPanel.utils';

const LOOKUP_DELAY_MS = 250;

const useDebouncedValue = (value: string, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

const findDeletedConcept = async (
  fqn: string
): Promise<OntologyConcept | null> => {
  try {
    const found = await getOntologyConceptByName(fqn);

    return found.deleted ? found : null;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
};

/**
 * A soft-deleted concept keeps its row and its name, so a new concept with that name
 * would be refused by the server. Finds the deleted concept holding the typed name.
 */
export const useDeletedConceptNamed = (
  ontology: Ontology,
  model: OntologyStudioModel,
  typedName: string
): OntologyConcept | undefined => {
  const name = typedName.trim();
  const lookupName = useDebouncedValue(name, LOOKUP_DELAY_MS);
  const { data } = useQuery({
    queryKey: ['ontology-deleted-concept', ontology.id, lookupName],
    enabled:
      isValidLocalName(lookupName) &&
      !model.concepts.some(
        (concept) => concept.iri === ontology.namespace + lookupName
      ),
    retry: false,
    queryFn: () =>
      findDeletedConcept(`${ontology.fullyQualifiedName}.${lookupName}`),
  });

  return lookupName === name && data?.name === name ? data : undefined;
};
