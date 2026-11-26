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
import { screen } from '@testing-library/react';
import { getActivityFeedTabCount, getEntityTabBar } from './ActivityFeed.utils';

describe('getEntityTabBar', () => {
  it('finds the tab list before the panel the feed renders in', () => {
    document.body.innerHTML = `
      <div>
        <div data-testid="tab-bar"></div>
        <div role="tabpanel"><section><div data-testid="feed"></div></section></div>
      </div>`;

    expect(getEntityTabBar(screen.getByTestId('feed'))).toBe(
      screen.getByTestId('tab-bar')
    );
  });

  // A feed outside an entity page's tabs (the Profile) has nothing to pin.
  it('finds nothing outside a tab panel', () => {
    document.body.innerHTML = '<div><div data-testid="feed"></div></div>';

    expect(getEntityTabBar(screen.getByTestId('feed'))).toBeNull();
  });
});

describe('getActivityFeedTabCount', () => {
  it('shows a complete count as it is', () => {
    expect(getActivityFeedTabCount(12, false)).toBe(12);
  });

  it('marks a capped count as a lower bound', () => {
    expect(getActivityFeedTabCount(219, true)).toBe('219+');
  });
});
