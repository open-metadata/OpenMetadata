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

import { EntityType } from '../../../enums/entity.enum';
import {
  ContextMemory,
  MemoryType,
  ShareVisibility,
} from '../../../generated/entity/context/contextMemory';
import { updateContextMemory } from '../../../rest/contextMemoryAPI';
import {
  getLinkedAssetPath,
  getQueryTableFqn,
  submitMemoryUpdate,
} from './CreateMemoryModal.utils';

jest.mock('../../../rest/contextMemoryAPI', () => ({
  createContextMemory: jest.fn(),
  updateContextMemory: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
}));

const learnedMemory: ContextMemory = {
  id: 'memory-id',
  name: 'orders-table-learning',
  question: 'sales.orders_v2 replaced sales.orders.',
  answer: 'sales.orders_v2 replaced sales.orders.',
  memoryType: MemoryType.Learning,
};

const saveEdit = (memoryTypeValue: MemoryType | undefined) =>
  submitMemoryUpdate({
    memoryToEdit: learnedMemory,
    title: '',
    memory: 'sales.orders_v2 replaced sales.orders in March.',
    memoryTypeValue,
    visibility: ShareVisibility.Private,
    selectedTags: [],
    primaryEntity: undefined,
    relatedEntities: [],
    t: (key: string) => key,
  });

const patchedPaths = () =>
  (updateContextMemory as jest.Mock).mock.calls[0][1].map(
    (operation: { path: string }) => operation.path
  );

describe('getLinkedAssetPath', () => {
  const query = {
    id: 'query-id',
    type: EntityType.QUERY,
    fullyQualifiedName: 'banking-redshift.48f70df04c8bc43ab75a5da5da4f95f7',
  };

  it('opens a Query full screen on the table it was linked from', () => {
    expect(getLinkedAssetPath(query, 'svc.db.sch.fct_fee_revenue')).toBe(
      '/query-view/svc.db.sch.fct_fee_revenue/query-id'
    );
  });

  it('leaves a Query with no linked table unlinked', () => {
    expect(getLinkedAssetPath(query)).toBeUndefined();
  });

  it('opens a Query only on the one table a memory links', () => {
    const table = (fqn: string) => ({
      displayName: fqn,
      reference: { id: fqn, type: EntityType.TABLE, fullyQualifiedName: fqn },
    });

    expect(getQueryTableFqn([table('svc.db.sch.a')])).toBe('svc.db.sch.a');
    expect(
      getQueryTableFqn([table('svc.db.sch.a'), table('svc.db.sch.b')])
    ).toBeUndefined();
    expect(getQueryTableFqn([])).toBeUndefined();
  });

  it('opens any other asset on its own page', () => {
    expect(
      getLinkedAssetPath({
        id: 'table-id',
        type: EntityType.TABLE,
        fullyQualifiedName: 'svc.db.sch.fct_fee_revenue',
      })
    ).toBe('/table/svc.db.sch.fct_fee_revenue');
  });

  // A memory extracted from a document links that document.
  it('opens a document in Context Center', () => {
    expect(
      getLinkedAssetPath({
        id: 'file-id',
        type: 'contextFile',
        fullyQualifiedName: 'policies.expense_policy.pdf',
      })
    ).toBe('/context-center/documents?document=file-id');
  });

  it('opens an article in Context Center', () => {
    expect(
      getLinkedAssetPath({
        id: 'page-id',
        type: EntityType.KNOWLEDGE_PAGE,
        fullyQualifiedName: 'expense_policy',
      })
    ).toBe('/context-center/articles/expense_policy');
  });

  it('leaves a type with no page of its own unlinked', () => {
    expect(
      getLinkedAssetPath({
        id: 'memory-id',
        type: 'contextMemory',
        fullyQualifiedName: 'refund-window',
      })
    ).toBeUndefined();
  });
});

describe('submitMemoryUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps a memory type the form does not offer', async () => {
    await saveEdit(undefined);

    expect(patchedPaths()).toContain('/answer');
    expect(patchedPaths()).not.toContain('/memoryType');
  });

  it('still changes such a type when the editor picks another one', async () => {
    await saveEdit(MemoryType.Note);

    expect((updateContextMemory as jest.Mock).mock.calls[0][1]).toContainEqual(
      expect.objectContaining({ path: '/memoryType', value: MemoryType.Note })
    );
  });
});
