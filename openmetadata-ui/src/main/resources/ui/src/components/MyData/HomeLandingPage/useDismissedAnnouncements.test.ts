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
import { act, renderHook } from '@testing-library/react';
import {
  activateTourMock,
  deactivateTourMock,
} from '../../../rest/product-tour/productTourMock';
import {
  getDismissedAnnouncementsStorageKey,
  useDismissedAnnouncements,
} from './useDismissedAnnouncements';

const USER_ID = 'user-1';
const KEY = getDismissedAnnouncementsStorageKey(USER_ID);

describe('useDismissedAnnouncements', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(KEY, JSON.stringify(['gone', 'still-live']));
  });

  afterEach(() => {
    deactivateTourMock();
  });

  it('forgets dismissals of announcements that are no longer live', () => {
    const { result } = renderHook(() => useDismissedAnnouncements(USER_ID));

    act(() => result.current.prune(['still-live']));

    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual([
      'still-live',
    ]);
  });

  it('keeps every dismissal while a product tour shows recorded announcements', () => {
    activateTourMock(async () => []);
    const { result } = renderHook(() => useDismissedAnnouncements(USER_ID));

    act(() => result.current.prune(['recorded-announcement']));

    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual([
      'gone',
      'still-live',
    ]);
  });
});
