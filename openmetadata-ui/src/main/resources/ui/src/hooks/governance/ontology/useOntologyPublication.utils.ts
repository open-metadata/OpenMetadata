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
import { listOntologyReleaseHistory } from '../../../rest/ontologyAPI';

export const latestVersionedOntologyRelease = async (
  ontologyId: string,
  signal: AbortSignal
) => {
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const response = await listOntologyReleaseHistory(
      ontologyId,
      { limit: 100, after },
      signal
    );
    if (response.data.some((release) => release.ontology.id !== ontologyId)) {
      throw new Error('Ontology release owner does not match the selection');
    }
    const versioned = response.data.find((release) => release.semanticVersion);
    if (versioned) {
      return versioned;
    }
    if (!response.paging.after) {
      return null;
    }
    if (response.paging.after === after) {
      throw new Error('Ontology release cursor did not advance');
    }
    after = response.paging.after;
  }

  throw new Error(
    'Latest versioned ontology release exceeds the bounded history lookup'
  );
};
