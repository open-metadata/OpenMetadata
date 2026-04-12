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
import {
  useRequestAccessUrl,
  __clearRequestAccessUrlCacheForTests,
} from './useRequestAccessUrl';

jest.mock('../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn(),
}));

jest.mock('../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn((entityType: string, fqn: string) => {
    return `/${entityType}/${fqn}`;
  }),
}));

describe('useRequestAccessUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __clearRequestAccessUrlCacheForTests();
  });

  it('should resolve request access URLs from service connection options', async () => {
    (getServiceByFQN as jest.Mock).mockResolvedValue({
      connection: {
        config: {
          connectionOptions: {
            requestAccessUrlTemplate:
              'https://access.example.com/new?asset={{entityFqnEncoded}}&url={{entityUrlEncoded}}',
          },
        },
      },
    });

    const { result } = renderHook(() =>
      useRequestAccessUrl({
        entityFqn: 'service.db.schema',
        entityType: EntityType.DATABASE_SCHEMA,
        serviceName: 'sample_service',
        serviceType: 'databaseService',
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getServiceByFQN).toHaveBeenCalledWith(
      'databaseServices',
      'sample_service'
    );
    expect(result.current.url).toBe(
      'https://access.example.com/new?asset=service.db.schema&url=http%3A%2F%2Flocalhost%2FdatabaseSchema%2Fservice.db.schema'
    );
  });

  it('should not fetch service data for unsupported entity types', () => {
    const { result } = renderHook(() =>
      useRequestAccessUrl({
        entityFqn: 'service.db.table',
        entityType: EntityType.TABLE,
        serviceName: 'sample_service',
        serviceType: 'databaseService',
      })
    );

    expect(getServiceByFQN).not.toHaveBeenCalled();
    expect(result.current.url).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should return null when the service has no request access URL configured', async () => {
    (getServiceByFQN as jest.Mock).mockResolvedValue({
      connection: {
        config: {
          connectionOptions: {},
        },
      },
    });

    const { result } = renderHook(() =>
      useRequestAccessUrl({
        entityFqn: 'service.db',
        entityType: EntityType.DATABASE,
        serviceName: 'sample_service',
        serviceType: 'databaseService',
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.url).toBeNull();
  });
});
