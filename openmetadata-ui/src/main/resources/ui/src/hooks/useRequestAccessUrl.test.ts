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

import { renderHook, waitFor } from '@testing-library/react';
import { EntityType } from '../enums/entity.enum';
import { getServiceByFQN } from '../rest/serviceAPI';
import { useRequestAccessUrl } from './useRequestAccessUrl';

jest.mock('../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn(),
}));

describe('useRequestAccessUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reuse the in-flight service lookup for cards from the same service', async () => {
    (getServiceByFQN as jest.Mock).mockResolvedValue({
      connection: {
        config: {
          connectionOptions: {
            requestAccessUrl:
              'https://access.example.com/new?asset={{entityFqnEncoded}}',
          },
        },
      },
    });

    const props = {
      entityName: 'Finance Dashboard',
      entityPath: '/dashboard/sample.finance_dashboard',
      entityType: EntityType.DASHBOARD,
      fullyQualifiedName: 'sample.finance_dashboard',
      service: {
        id: 'service-id',
        name: 'sample_dashboard',
        type: 'dashboardService',
      },
      serviceType: 'Tableau',
      sourceUrl: 'https://tableau.example.com/views/finance',
    };

    const firstHook = renderHook(() => useRequestAccessUrl(props));
    const secondHook = renderHook(() => useRequestAccessUrl(props));

    await waitFor(() => {
      expect(firstHook.result.current).toBe(
        'https://access.example.com/new?asset=sample.finance_dashboard'
      );
      expect(secondHook.result.current).toBe(
        'https://access.example.com/new?asset=sample.finance_dashboard'
      );
    });

    expect(getServiceByFQN).toHaveBeenCalledTimes(1);
  });
});
