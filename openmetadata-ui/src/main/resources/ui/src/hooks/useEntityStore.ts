/*
 *  Copyright 2024 Collate.
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
import { create } from 'zustand';
import { FqnPart } from '../enums/entity.enum';
import { EntityStore } from '../interface/store.interface';
import { getPartialNameFromTableFQN } from '../utils/CommonUtils';

export const useEntityStore = create<EntityStore>((set, get) => ({
  activeFqn: null,
  setActiveFqn: (fqn) => set({ activeFqn: fqn }),
  getFqnContext: () => {
    const fqn = get()?.activeFqn ?? '';

    return {
      databaseName: getPartialNameFromTableFQN(fqn, [FqnPart.Database]),
      schemaName: getPartialNameFromTableFQN(fqn, [FqnPart.Schema]),
      tableName: getPartialNameFromTableFQN(fqn, [FqnPart.Table]),
    };
  },
}));
