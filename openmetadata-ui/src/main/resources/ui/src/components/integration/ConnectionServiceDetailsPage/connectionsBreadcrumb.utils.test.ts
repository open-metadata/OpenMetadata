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

import { TFunction } from 'i18next';
import { getServiceCategoryBreadcrumb } from './connectionsBreadcrumb.utils';

const t = ((key: string) => key) as unknown as TFunction;

describe('getServiceCategoryBreadcrumb', () => {
  it('names the category and links to its tab on the listing', () => {
    const crumb = getServiceCategoryBreadcrumb(t, 'databaseServices');

    // The crumb it replaced showed the connector ("Mysql") and went nowhere. The level above a
    // service is its category, and the listing tabs by exactly that, so it is a real destination.
    expect(crumb).toEqual({
      ariaLabel: 'label.database-service',
      href: '/connections?category=databaseServices',
      label: 'label.database-service',
    });
  });

  it('links each tabbed category to its own tab', () => {
    expect(getServiceCategoryBreadcrumb(t, 'dashboardServices')?.href).toBe(
      '/connections?category=dashboardServices'
    );
    expect(getServiceCategoryBreadcrumb(t, 'securityServices')?.href).toBe(
      '/connections?category=securityServices'
    );
  });

  it('is dropped for a category the listing does not tab', () => {
    // llm/mcp services have no tab, so a crumb would point at a tab that does not exist.
    expect(getServiceCategoryBreadcrumb(t, 'llmServices')).toBeNull();
    expect(getServiceCategoryBreadcrumb(t, undefined)).toBeNull();
  });
});
