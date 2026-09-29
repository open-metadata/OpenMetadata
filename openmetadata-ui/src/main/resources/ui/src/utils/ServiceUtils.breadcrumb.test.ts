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

import { ServiceCategory } from '../enums/service.enum';
import connectionsRouterClassBase from './ConnectionsRouterClassBase';
import { getAddServiceEntityBreadcrumb } from './ServiceUtils';

describe('getAddServiceEntityBreadcrumb', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('points the category crumb at the settings services page by default', () => {
    const [category] = getAddServiceEntityBreadcrumb(
      ServiceCategory.DATABASE_SERVICES
    );

    expect(category.id).toBe('category');
    expect(category.href).toBe('/settings/services/databases');
  });

  // The Add Service flow is reachable from an embedded listing, so its "back to the category"
  // crumb has to return to that listing rather than to the settings page the user never saw.
  it('follows the router when an embedded experience owns the listing', () => {
    const spy = jest
      .spyOn(connectionsRouterClassBase, 'getSettingsServicesPath')
      .mockReturnValue('/connections?category=databaseServices');

    const [category] = getAddServiceEntityBreadcrumb(
      ServiceCategory.DATABASE_SERVICES
    );

    expect(category.href).toBe('/connections?category=databaseServices');
    expect(spy).toHaveBeenCalledWith(ServiceCategory.DATABASE_SERVICES);
  });
});
