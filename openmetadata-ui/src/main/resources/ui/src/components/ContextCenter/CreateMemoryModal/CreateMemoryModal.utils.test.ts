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

import {
  ContextMemory,
  MemoryType,
  ShareVisibility,
} from '../../../generated/entity/context/contextMemory';
import { updateContextMemory } from '../../../rest/contextMemoryAPI';
import { submitMemoryUpdate } from './CreateMemoryModal.utils';

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
