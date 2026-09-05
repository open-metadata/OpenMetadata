/*
 *  Copyright 2025 Collate.
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

import { EXTENSION_POINTS, TabContribution } from './ExtensionPointTypes';

describe('EXTENSION_POINTS connections slots', () => {
  it('exposes the connections page/detail/onboarding/route ids', () => {
    expect(EXTENSION_POINTS.CONNECTIONS_PAGE_FOOTER).toBe(
      'connections.page.footer'
    );
    expect(EXTENSION_POINTS.SERVICE_DETAILS_FOOTER).toBe(
      'service-details.footer'
    );
    expect(EXTENSION_POINTS.CONNECTIONS_LIST_ONBOARDING).toBe(
      'connections.list.onboarding'
    );
    expect(EXTENSION_POINTS.CONNECTIONS_ROUTES).toBe('connections.routes');
  });
});

describe('TabContribution', () => {
  it('accepts an optional order field for tab sorting', () => {
    const tabContribution: TabContribution = {
      key: 'test-tab',
      label: 'Test Tab',
      component: () => null,
      order: 1,
    };

    expect(tabContribution.order).toBe(1);
  });
});
