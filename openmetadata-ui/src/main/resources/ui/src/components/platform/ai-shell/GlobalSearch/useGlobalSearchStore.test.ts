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
import { useGlobalSearchStore } from './useGlobalSearchStore';

describe('useGlobalSearchStore', () => {
  beforeEach(() => {
    useGlobalSearchStore.setState({ isOpen: false, entry: 'all' });
  });

  it('starts closed with the all entry', () => {
    expect(useGlobalSearchStore.getState()).toMatchObject({
      isOpen: false,
      entry: 'all',
    });
  });

  it('opens with the all entry by default', () => {
    useGlobalSearchStore.setState({ entry: 'chats' });
    useGlobalSearchStore.getState().openSearch();

    expect(useGlobalSearchStore.getState()).toMatchObject({
      isOpen: true,
      entry: 'all',
    });
  });

  it('opens scoped to the given entry', () => {
    useGlobalSearchStore.getState().openSearch('chats');

    expect(useGlobalSearchStore.getState()).toMatchObject({
      isOpen: true,
      entry: 'chats',
    });
  });

  it('closes and keeps the last entry', () => {
    useGlobalSearchStore.getState().openSearch('chats');
    useGlobalSearchStore.getState().close();

    expect(useGlobalSearchStore.getState()).toMatchObject({
      isOpen: false,
      entry: 'chats',
    });
  });
});
