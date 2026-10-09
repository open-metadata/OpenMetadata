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

import { Document } from '../../../../../../../generated/entity/docStore/document';
import {
    createDocument,
    updateDocument
} from '../../../../../../../rest/DocStoreAPI';
import { savePersonaDocument } from './customizeEditor.utils';

jest.mock('../../../../../../../rest/DocStoreAPI', () => ({
  createDocument: jest.fn().mockResolvedValue({ id: 'created' }),
  updateDocument: jest.fn().mockResolvedValue({ id: 'updated' }),
}));

const baseDocument = {
  name: 'persona-doc',
  fullyQualifiedName: 'persona.doc',
  entityType: 'PersonaPreferences',
  data: { pages: [] },
  domains: [
    { id: 'd1', type: 'domain', fullyQualifiedName: 'Finance' },
    { id: 'd2', type: 'domain' },
  ],
} as unknown as Document;

describe('savePersonaDocument', () => {
  it('patches an existing document with the diff produced by the mutation', async () => {
    const document = { ...baseDocument, id: 'doc-1' } as Document;

    const result = await savePersonaDocument(document, (draft) => {
      draft.name = 'renamed';
    });

    expect(result).toEqual({ id: 'updated' });
    expect(updateDocument).toHaveBeenCalledWith('doc-1', [
      { op: 'replace', path: '/name', value: 'renamed' },
    ]);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('does not mutate the original document', async () => {
    const document = { ...baseDocument, id: 'doc-1' } as Document;

    await savePersonaDocument(document, (draft) => {
      draft.name = 'renamed';
    });

    expect(document.name).toBe('persona-doc');
  });

  it('creates a new document with domain references flattened to FQNs', async () => {
    const result = await savePersonaDocument(baseDocument, (draft) => {
      draft.name = 'new-doc';
    });

    expect(result).toEqual({ id: 'created' });
    expect(updateDocument).not.toHaveBeenCalled();
    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'new-doc', domains: ['Finance'] })
    );
  });

  it('creates a document without domains when none are set', async () => {
    const { domains: _domains, ...withoutDomains } = baseDocument;

    await savePersonaDocument(withoutDomains as Document, () => undefined);

    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ domains: undefined })
    );
  });
});
