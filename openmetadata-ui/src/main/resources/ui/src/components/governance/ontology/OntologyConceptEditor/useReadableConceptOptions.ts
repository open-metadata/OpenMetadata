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
import { useEffect, useState } from 'react';
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
): OntologyIriOption[] => {
  const [options, setOptions] = useState<OntologyIriOption[]>([]);

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
    load().catch(() => undefined);

    return () => controller.abort();
  }, [enabled]);

  return options;
};
