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
  createDocumentTitleStore,
  DocumentTitlePriority,
} from './DocumentTitle.store';

const claim = (title: string, overrides = {}) => ({
  title,
  priority: DocumentTitlePriority.PAGE,
  visible: true,
  ...overrides,
});

describe('DocumentTitle store', () => {
  it('resolves nothing while unclaimed', () => {
    expect(createDocumentTitleStore().getSegments()).toEqual([]);
  });

  it('lets a page outrank the shell whichever registers first', () => {
    const shell = Symbol('shell');
    const page = Symbol('page');

    const shellFirst = createDocumentTitleStore();
    shellFirst.set(
      shell,
      claim('Collate AI', { priority: DocumentTitlePriority.SHELL })
    );
    shellFirst.set(page, claim('dim_customer'));

    const shellLast = createDocumentTitleStore();
    shellLast.set(page, claim('dim_customer'));
    shellLast.set(
      shell,
      claim('Collate AI', { priority: DocumentTitlePriority.SHELL })
    );

    expect(shellFirst.getSegments()).toEqual(['dim_customer']);
    expect(shellLast.getSegments()).toEqual(['dim_customer']);
  });

  it('prefers the later claim within a priority', () => {
    const store = createDocumentTitleStore();
    store.set(Symbol('layout'), claim('Glossary'));
    store.set(Symbol('panel'), claim('Banking Core'));

    expect(store.getSegments()).toEqual(['Banking Core']);
  });

  it('keeps a claim in place across updates', () => {
    const store = createDocumentTitleStore();
    const layout = Symbol('layout');
    const panel = Symbol('panel');
    store.set(layout, claim('Glossary'));
    store.set(panel, claim('Banking Core'));

    expect(store.getSegments()).toEqual(['Banking Core']);

    // A re-registering layout must not jump ahead of the nested claim.
    store.set(layout, claim('Glossary'));

    expect(store.getSegments()).toEqual(['Banking Core']);
  });

  it('ignores a hidden claim', () => {
    const store = createDocumentTitleStore();
    store.set(Symbol('visible'), claim('dim_customer'));
    store.set(Symbol('cached'), claim('Explore', { visible: false }));

    expect(store.getSegments()).toEqual(['dim_customer']);
  });

  it('appends the active tab after the title', () => {
    const store = createDocumentTitleStore();
    store.set(Symbol('panel'), claim('Banking Core', { tabLabel: 'Terms' }));

    expect(store.getSegments()).toEqual(['Banking Core', 'Terms']);
  });

  it('drops a claim whose title goes empty, and on removal', () => {
    const store = createDocumentTitleStore();
    const page = Symbol('page');
    store.set(Symbol('shell'), claim('Collate AI', { priority: 0 }));
    store.set(page, claim('dim_customer'));

    expect(store.getSegments()).toEqual(['dim_customer']);

    store.set(page, claim(''));

    expect(store.getSegments()).toEqual(['Collate AI']);
  });

  it('notifies subscribers only when the resolved title changes', () => {
    const store = createDocumentTitleStore();
    const listener = jest.fn();
    store.subscribe(listener);

    const page = Symbol('page');
    store.set(page, claim('dim_customer'));

    expect(listener).toHaveBeenCalledTimes(1);

    store.set(page, claim('dim_customer'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns a stable snapshot so useSyncExternalStore does not loop', () => {
    const store = createDocumentTitleStore();
    store.set(Symbol('page'), claim('dim_customer'));

    expect(store.getSegments()).toBe(store.getSegments());
  });
});
