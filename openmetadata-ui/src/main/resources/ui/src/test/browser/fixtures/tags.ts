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
import { http, HttpResponse } from 'msw';
import { Tag } from '../../../generated/entity/classification/tag';
import { worker } from '../msw';

/** A classification tag as the server returns it, from the seeded data. */
const tag = (classification: string, name: string, id: number): Tag => ({
  id: `5a9c0d7e-0000-4000-8000-${String(id).padStart(12, '0')}`,
  name,
  displayName: name,
  fullyQualifiedName: `${classification}.${name}`,
  description: `${classification} ${name}`,
  classification: {
    id: `5a9c0d7e-0000-4000-8000-${String(id * 100).padStart(12, '0')}`,
    type: 'classification',
    name: classification,
    fullyQualifiedName: classification,
  },
  deleted: false,
});

/** Seeded Tier classification (json/data/tags/tierTags.json). */
export const TIERS: Tag[] = [1, 2, 3, 4, 5].map((n) =>
  tag('Tier', `Tier${n}`, n)
);

/** Seeded tags the spec assigns (personalDataTags.json, piiTags). */
export const PERSONAL_DATA_PERSONAL = tag('PersonalData', 'Personal', 11);
export const PII_NONE = tag('PII', 'None', 21);
export const CLASSIFICATION_TAGS = [PERSONAL_DATA_PERSONAL, PII_NONE];

/** `GET /tags?parent=Tier` — what the tier picker lists. */
export const serveTiers = () =>
  worker.use(
    http.get('/api/v1/tags', ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.get('parent') === 'Tier'
          ? { data: TIERS, paging: { total: TIERS.length } }
          : { data: [], paging: { total: 0 } }
      )
    )
  );
