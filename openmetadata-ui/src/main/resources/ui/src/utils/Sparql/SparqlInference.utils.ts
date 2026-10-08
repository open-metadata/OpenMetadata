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

import type { SparqlPlaygroundInference } from '../../rest/rdfAPI';

const PLAYGROUND_INFERENCE_BY_STATUS_LEVEL: Readonly<
  Record<string, SparqlPlaygroundInference>
> = {
  CUSTOM: 'custom',
  NONE: 'none',
  OWL_DL: 'owl',
  OWL_LITE: 'owl',
  RDFS: 'rdfs',
};

/**
 * Maps the reasoning levels reported by the RDF status endpoint to the inference options a SPARQL
 * query can request. Querying without inference is always possible.
 */
export const getAvailableSparqlInferences = (
  availableLevels: ReadonlyArray<string> = []
): SparqlPlaygroundInference[] => {
  const available = new Set<SparqlPlaygroundInference>(['none']);
  availableLevels.forEach((level) => {
    const inference = PLAYGROUND_INFERENCE_BY_STATUS_LEVEL[level];
    if (inference) {
      available.add(inference);
    }
  });

  return [...available];
};
