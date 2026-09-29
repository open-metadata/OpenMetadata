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
import { getServiceCategoryBreadcrumb } from './EntityServiceBreadcrumbUtils';

describe('getServiceCategoryBreadcrumb', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('points at the settings services page by default', () => {
    const [crumb] = getServiceCategoryBreadcrumb(ServiceCategory.API_SERVICES);

    expect(crumb.name).toBe('Api Services');
    expect(crumb.url).toBe('/settings/services/apiServices');
  });

  it.each([
    [ServiceCategory.DATABASE_SERVICES, '/settings/services/databases'],
    [ServiceCategory.DASHBOARD_SERVICES, '/settings/services/dashboards'],
    [ServiceCategory.MESSAGING_SERVICES, '/settings/services/messaging'],
    [ServiceCategory.PIPELINE_SERVICES, '/settings/services/pipelines'],
  ])('builds the settings path for %s', (category, expected) => {
    expect(getServiceCategoryBreadcrumb(category)[0].url).toBe(expected);
  });

  it('follows the router when an embedded experience owns the listing', () => {
    // The crumb used to build this URL inline, so an experience that lists services elsewhere
    // could not redirect it and every entity breadcrumb — API collection, database, topic —
    // still walked the user into the settings page.
    jest
      .spyOn(connectionsRouterClassBase, 'getSettingsServicesPath')
      .mockReturnValue('/connections?category=apiServices');

    const [crumb] = getServiceCategoryBreadcrumb(ServiceCategory.API_SERVICES);

    expect(crumb.url).toBe('/connections?category=apiServices');
    expect(
      connectionsRouterClassBase.getSettingsServicesPath
    ).toHaveBeenCalledWith(ServiceCategory.API_SERVICES);
  });
});
