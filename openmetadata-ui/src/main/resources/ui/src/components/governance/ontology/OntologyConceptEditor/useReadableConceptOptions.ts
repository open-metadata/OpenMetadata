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
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { listOntologyConcepts } from '../../../../rest/ontologyAPI';
import { OntologyIriOption } from '../OntologyIriInput/OntologyIriInput.types';

const PAGE_SIZE = 1000;
const MAX_PAGES = 5;

const toOption = (concept: OntologyConcept): OntologyIriOption => ({
  iri: concept.iri,
  label: concept.displayName ?? concept.name,
  context: concept.ontology.displayName ?? concept.ontology.name,
});

/**
 * Concepts from every ontology the caller can read, for pickers that may point
 * outside the ontology being edited. The list endpoint has no name filter and
 * concepts are not search-indexed, so this pages through it and the picker
 * filters locally; the page cap bounds the work on very large catalogs.
 */
export const useReadableConceptOptions = (
  enabled: boolean
): { options: OntologyIriOption[]; isLoading: boolean } => {
  const [options, setOptions] = useState<OntologyIriOption[]>([]);
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const controller = new AbortController();
    const load = async () => {
      const loaded: OntologyIriOption[] = [];
      let after: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await listOntologyConcepts(
          { limit: PAGE_SIZE, after },
          controller.signal
        );
        loaded.push(...response.data.map(toOption));
        after = response.paging.after;
        if (!after) {
          break;
        }
      }
      setOptions(loaded);
    };
    load()
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSettled(true);
        }
      });

    return () => controller.abort();
  }, [enabled]);

  return { options, isLoading: enabled && !isSettled };
};

/**
 * Targets for a mapping row: the concepts the caller already holds first, then
 * every other readable concept, so a mapping can point into another ontology
 * by label. Anything not listed is still accepted as a pasted absolute IRI.
 */
export const useMappingTargetOptions = (
  local: ReadonlyArray<OntologyIriOption> | undefined,
  enabled: boolean
): { options: OntologyIriOption[]; isLoading: boolean } => {
  const { options: readable, isLoading } = useReadableConceptOptions(enabled);

  return useMemo(() => {
    const held = new Set((local ?? []).map((option) => option.iri));

    return {
      options: [
        ...(local ?? []),
        ...readable.filter((option) => !held.has(option.iri)),
      ],
      isLoading,
    };
  }, [local, readable, isLoading]);
};
