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
import type { APICollection } from '../generated/entity/data/apiCollection';
import type { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import connectionsRouterClassBase from './ConnectionsRouterClassBase';
import {
  getBreadCrumbForAPICollection,
  getBreadCrumbForAPIEndpoint,
} from './EntityDataBreadcrumbUtils';

const SERVICE = {
  id: 'service-id',
  name: 'ometa_api_service',
  type: 'apiService',
};

const API_COLLECTION = {
  id: 'collection-id',
  name: 'tables',
  service: SERVICE,
} as APICollection;

const API_ENDPOINT = {
  id: 'endpoint-id',
  name: 'listTables',
  service: SERVICE,
  apiCollection: { id: 'collection-id', name: 'tables', type: 'apiCollection' },
} as APIEndpoint;

describe('API breadcrumbs point at whatever surface owns the service listing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['collection', () => getBreadCrumbForAPICollection(API_COLLECTION)],
    ['endpoint', () => getBreadCrumbForAPIEndpoint(API_ENDPOINT)],
  ])('builds the settings path for an API %s by default', (_, build) => {
    const [crumb] = build();

    expect(crumb.name).toBe('Api Services');
    expect(crumb.url).toBe('/settings/services/apiServices');
  });

  // These two crumbs used to build the settings URL inline, so an experience that lists services
  // elsewhere could not redirect them. It could only intercept the settings route itself, and by
  // then the service category was gone from the path — which is how "Api Services" landed on the
  // unfiltered listing instead of the API tab.
  it.each([
    ['collection', () => getBreadCrumbForAPICollection(API_COLLECTION)],
    ['endpoint', () => getBreadCrumbForAPIEndpoint(API_ENDPOINT)],
  ])('follows the router for an API %s, category included', (_, build) => {
    const spy = jest
      .spyOn(connectionsRouterClassBase, 'getSettingsServicesPath')
      .mockReturnValue('/connections?category=apiServices');

    const [crumb] = build();

    expect(crumb.url).toBe('/connections?category=apiServices');
    expect(spy).toHaveBeenCalledWith(ServiceCategory.API_SERVICES);
  });
});
