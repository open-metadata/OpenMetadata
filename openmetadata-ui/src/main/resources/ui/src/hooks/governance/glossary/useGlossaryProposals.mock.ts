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
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { SearchGlossaryTermsParams } from '../../../rest/glossaryAPI';

const hasStatus = (term: GlossaryTerm, entityStatus?: string) =>
  !entityStatus || entityStatus.split(',').includes(term.entityStatus ?? '');

const hasProvider = (
  term: GlossaryTerm,
  { provider, excludeProvider }: SearchGlossaryTermsParams
) =>
  (!provider || term.provider === provider) &&
  (!excludeProvider || term.provider !== excludeProvider);

const matchesQuery = (term: GlossaryTerm, q?: string) =>
  !q || term.name.toLowerCase().includes(q.toLowerCase());

/** Answers term searches the way the server filters and pages them, over the terms a test holds. */
export const searchTerms =
  (getTerms: () => GlossaryTerm[]) =>
  async (params: SearchGlossaryTermsParams) => {
    const { entityStatus, limit = 10, offset = 0 } = params;
    const matching = getTerms().filter(
      (term) =>
        hasStatus(term, entityStatus) &&
        hasProvider(term, params) &&
        matchesQuery(term, params.q)
    );

    return {
      data: matching.slice(offset, offset + limit),
      paging: { total: matching.length },
    };
  };
