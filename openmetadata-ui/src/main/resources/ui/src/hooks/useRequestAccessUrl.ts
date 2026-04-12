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
import { get } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategoryPlural } from '../enums/service.enum';
import { getServiceByFQN } from '../rest/serviceAPI';
import { getRequestAccessUrl } from '../utils/RequestAccessUtils';
import { getEntityDetailsPath } from '../utils/RouterUtils';

type CacheEntry = {
  value: Record<string, string> | undefined;
  timestamp: number;
  inFlight?: Promise<Record<string, string> | undefined>;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const connectionOptionsCache = new Map<string, CacheEntry>();

export const __clearRequestAccessUrlCacheForTests = () => {
  connectionOptionsCache.clear();
};

const SUPPORTED_ENTITY_TYPES = new Set<EntityType>([
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.DASHBOARD,
]);

export const isRequestAccessSupportedEntityType = (
  entityType?: EntityType
): entityType is EntityType =>
  entityType ? SUPPORTED_ENTITY_TYPES.has(entityType) : false;

export const useRequestAccessUrl = ({
  entityFqn,
  entityType,
  serviceName,
  serviceType,
}: {
  entityFqn?: string;
  entityType?: EntityType;
  serviceName?: string;
  serviceType?: string;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const serviceCategory = useMemo(
    () =>
      serviceType
        ? ServiceCategoryPlural[
            serviceType as keyof typeof ServiceCategoryPlural
          ]
        : undefined,
    [serviceType]
  );

  useEffect(() => {
    if (
      !entityFqn ||
      !entityType ||
      !serviceName ||
      !serviceCategory ||
      !isRequestAccessSupportedEntityType(entityType)
    ) {
      setUrl(null);
      setIsLoading(false);

      return;
    }

    let isMounted = true;

    const fetchRequestAccessUrl = async () => {
      setUrl(null);
      setIsLoading(true);

      try {
        const cacheKey = `${serviceCategory}::${serviceName}`;
        let connectionOptions: Record<string, string> | undefined;

        const now = Date.now();
        const cachedEntry = connectionOptionsCache.get(cacheKey);

        if (cachedEntry && now - cachedEntry.timestamp >= CACHE_TTL_MS) {
          connectionOptionsCache.delete(cacheKey);
        }

        const freshEntry = connectionOptionsCache.get(cacheKey);
        if (freshEntry?.inFlight) {
          connectionOptions = await freshEntry.inFlight;
        } else if (freshEntry && now - freshEntry.timestamp < CACHE_TTL_MS) {
          connectionOptions = freshEntry.value;
        } else {
          const inFlight = (async () => {
            const service = await getServiceByFQN(serviceCategory, serviceName);

            return get(service, 'connection.config.connectionOptions') as
              | Record<string, string>
              | undefined;
          })();

          connectionOptionsCache.set(cacheKey, {
            value: undefined,
            timestamp: now,
            inFlight,
          });

          try {
            connectionOptions = await inFlight;
            connectionOptionsCache.set(cacheKey, {
              value: connectionOptions,
              timestamp: Date.now(),
            });
          } catch (err) {
            connectionOptionsCache.delete(cacheKey);
            throw err;
          }
        }
        const entityUrl = `${window.location.origin}${getEntityDetailsPath(
          entityType,
          entityFqn
        )}`;

        if (isMounted) {
          setUrl(
            getRequestAccessUrl({
              connectionOptions,
              entityFqn,
              entityUrl,
            })
          );
        }
      } catch {
        if (isMounted) {
          setUrl(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRequestAccessUrl();

    return () => {
      isMounted = false;
    };
  }, [entityFqn, entityType, serviceCategory, serviceName]);

  return { url, isLoading };
};
