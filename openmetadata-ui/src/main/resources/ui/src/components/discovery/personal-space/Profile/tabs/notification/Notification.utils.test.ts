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

import { hashSubPathToView, viewToSubPath } from './Notification.utils';

describe('hashSubPathToView', () => {
  it('returns landing for empty string', () => {
    expect(hashSubPathToView('')).toEqual({ type: 'landing' });
  });

  it('returns list for "alerts"', () => {
    expect(hashSubPathToView('alerts')).toEqual({ type: 'list' });
  });

  it('returns add for "alerts/add"', () => {
    expect(hashSubPathToView('alerts/add')).toEqual({ type: 'add' });
  });

  it('returns edit for "alerts/edit/<fqn>"', () => {
    expect(hashSubPathToView('alerts/edit/my-alert')).toEqual({
      type: 'edit',
      fqn: 'my-alert',
    });
  });

  it('returns edit with compound fqn', () => {
    expect(hashSubPathToView('alerts/edit/org/my-alert')).toEqual({
      type: 'edit',
      fqn: 'org/my-alert',
    });
  });

  it('returns detail for "alerts/<fqn>"', () => {
    expect(hashSubPathToView('alerts/my-alert')).toEqual({
      type: 'detail',
      fqn: 'my-alert',
      name: 'my-alert',
    });
  });

  it('returns landing for unknown path', () => {
    expect(hashSubPathToView('unknown')).toEqual({ type: 'landing' });
  });
});

describe('viewToSubPath', () => {
  it('returns undefined for landing', () => {
    expect(viewToSubPath({ type: 'landing' })).toBeUndefined();
  });

  it('returns "alerts" for list', () => {
    expect(viewToSubPath({ type: 'list' })).toBe('alerts');
  });

  it('returns "alerts/add" for add', () => {
    expect(viewToSubPath({ type: 'add' })).toBe('alerts/add');
  });

  it('returns "alerts/edit/<fqn>" for edit', () => {
    expect(viewToSubPath({ type: 'edit', fqn: 'my-alert' })).toBe(
      'alerts/edit/my-alert'
    );
  });

  it('returns "alerts/<fqn>" for detail', () => {
    expect(
      viewToSubPath({ type: 'detail', fqn: 'my-alert', name: 'My Alert' })
    ).toBe('alerts/my-alert');
  });
});

describe('round-trip', () => {
  it('list round-trips', () => {
    const view = { type: 'list' as const };

    expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
  });

  it('add round-trips', () => {
    const view = { type: 'add' as const };

    expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
  });

  it('edit round-trips', () => {
    const view = { type: 'edit' as const, fqn: 'my-alert' };

    expect(hashSubPathToView(viewToSubPath(view) ?? '')).toEqual(view);
  });
});
