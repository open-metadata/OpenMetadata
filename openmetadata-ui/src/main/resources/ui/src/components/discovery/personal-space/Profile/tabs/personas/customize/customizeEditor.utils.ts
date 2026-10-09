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

import { compare } from 'fast-json-patch';
import { cloneDeep } from 'lodash';
import { Document } from '../../../../../../../generated/entity/docStore/document';
import {
  createDocument,
  updateDocument,
} from '../../../../../../../rest/DocStoreAPI';

/**
 * Persist a mutation to a persona's UICustomization document: a PATCH when it
 * already exists, otherwise a create. Shared by every customize editor so the
 * create/update boilerplate lives in one place.
 */
export const savePersonaDocument = async (
  document: Document,
  mutate: (draft: Document) => void
): Promise<Document> => {
  const draft = cloneDeep(document);
  mutate(draft);

  if (document.id) {
    return updateDocument(document.id, compare(document, draft));
  }

  return createDocument({
    ...draft,
    domains: draft.domains
      ?.map((d) => d.fullyQualifiedName)
      .filter(Boolean) as string[],
  });
};
