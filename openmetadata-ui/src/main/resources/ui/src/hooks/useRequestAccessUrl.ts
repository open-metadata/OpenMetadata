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

import { useEffect, useState } from 'react';
import { ServiceCategoryPlural } from '../enums/service.enum';
import { EntityReference } from '../generated/entity/type';
import { getServiceByFQN } from '../rest/serviceAPI';
import {
  buildRequestAccessUrl,
  getRequestAccessTemplate,
  isRequestAccessSupportedEntityType,
  RequestAccessContext,
} from '../utils/RequestAccessUtils';

const requestAccessTemplateCache = new Map<string, string | null>();
const requestAccessTemplatePromiseCache = new Map<
  string,
  Promise<string | null>
>();

type UseRequestAccessUrlProps = RequestAccessContext & {
  service?: EntityReference;
};

export const useRequestAccessUrl = ({
  service,
  ...context
}: UseRequestAccessUrlProps) => {
  const [requestAccessUrl, setRequestAccessUrl] = useState<string>();

  useEffect(() => {
    let isActive = true;

    const fetchRequestAccessUrl = async () => {
      if (
        !service?.name ||
        !service?.type ||
        !isRequestAccessSupportedEntityType(context.entityType)
      ) {
        if (isActive) {
          setRequestAccessUrl(undefined);
        }

        return;
      }

      const serviceCategory =
        ServiceCategoryPlural[
          service.type as keyof typeof ServiceCategoryPlural
        ];

      if (!serviceCategory) {
        if (isActive) {
          setRequestAccessUrl(undefined);
        }

        return;
      }

      const cacheKey = `${serviceCategory}:${service.name}`;

      try {
        let requestAccessTemplate = requestAccessTemplateCache.get(cacheKey);

        if (requestAccessTemplate === undefined) {
          let requestAccessTemplatePromise =
            requestAccessTemplatePromiseCache.get(cacheKey);

          if (!requestAccessTemplatePromise) {
            requestAccessTemplatePromise = getServiceByFQN(
              serviceCategory,
              service.name
            )
              .then((serviceDetails) => {
                const resolvedTemplate =
                  getRequestAccessTemplate(serviceDetails) ?? null;

                requestAccessTemplateCache.set(cacheKey, resolvedTemplate);

                return resolvedTemplate;
              })
              .finally(() => {
                requestAccessTemplatePromiseCache.delete(cacheKey);
              });

            requestAccessTemplatePromiseCache.set(
              cacheKey,
              requestAccessTemplatePromise
            );
          }

          requestAccessTemplate = await requestAccessTemplatePromise;
        }

        if (isActive) {
          setRequestAccessUrl(
            requestAccessTemplate
              ? buildRequestAccessUrl(requestAccessTemplate, {
                  ...context,
                  serviceName: service.name,
                })
              : undefined
          );
        }
      } catch {
        if (isActive) {
          setRequestAccessUrl(undefined);
        }
      }
    };

    void fetchRequestAccessUrl();

    return () => {
      isActive = false;
    };
  }, [
    context.entityName,
    context.entityPath,
    context.entityType,
    context.fullyQualifiedName,
    context.serviceType,
    context.sourceUrl,
    service?.name,
    service?.type,
  ]);

  return requestAccessUrl;
};
