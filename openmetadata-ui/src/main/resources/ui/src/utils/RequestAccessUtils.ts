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

import { get, isEmpty } from 'lodash';
import { EntityType } from '../enums/entity.enum';
import { ServicesType } from '../interface/service.interface';

export const REQUEST_ACCESS_URL_OPTION_KEYS = [
  'requestAccessUrl',
  'requestAccessUrlTemplate',
] as const;
const REQUEST_ACCESS_ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export type RequestAccessContext = {
  entityName?: string;
  entityPath?: string;
  entityType?: string;
  fullyQualifiedName?: string;
  serviceName?: string;
  serviceType?: string;
  sourceUrl?: string;
};

export const isRequestAccessSupportedEntityType = (entityType?: string) =>
  [
    EntityType.DATABASE,
    EntityType.DATABASE_SCHEMA,
    EntityType.DASHBOARD,
  ].includes(entityType as EntityType);

export const getRequestAccessTemplate = (
  service?: ServicesType
): string | undefined => {
  const connectionOptions = get(
    service,
    'connection.config.connectionOptions'
  ) as Record<string, string> | undefined;

  if (!connectionOptions) {
    return undefined;
  }

  const templateKey = REQUEST_ACCESS_URL_OPTION_KEYS.find(
    (key) => connectionOptions[key]
  );

  return templateKey ? connectionOptions[templateKey] : undefined;
};

const replaceToken = (value: string, token: string, replacement: string) =>
  value
    .replaceAll(`{{${token}}}`, replacement)
    .replaceAll(`{${token}}`, replacement);

export const buildRequestAccessUrl = (
  template: string,
  context: RequestAccessContext,
  origin = window.location.origin
): string | undefined => {
  if (
    isEmpty(template) ||
    !isRequestAccessSupportedEntityType(context.entityType)
  ) {
    return undefined;
  }

  const entityUrl = context.entityPath
    ? new URL(context.entityPath, origin).toString()
    : '';

  // Support both `{token}` and `{{token}}` placeholders so connection options
  // can remain easy to author in external request systems.
  const replacements = {
    entityFqn: context.fullyQualifiedName ?? '',
    entityFqnEncoded: encodeURIComponent(context.fullyQualifiedName ?? ''),
    entityName: context.entityName ?? '',
    entityNameEncoded: encodeURIComponent(context.entityName ?? ''),
    entityPath: context.entityPath ?? '',
    entityPathEncoded: encodeURIComponent(context.entityPath ?? ''),
    entityType: context.entityType ?? '',
    entityTypeEncoded: encodeURIComponent(context.entityType ?? ''),
    entityUrl,
    entityUrlEncoded: encodeURIComponent(entityUrl),
    serviceName: context.serviceName ?? '',
    serviceNameEncoded: encodeURIComponent(context.serviceName ?? ''),
    serviceType: context.serviceType ?? '',
    serviceTypeEncoded: encodeURIComponent(context.serviceType ?? ''),
    sourceUrl: context.sourceUrl ?? '',
    sourceUrlEncoded: encodeURIComponent(context.sourceUrl ?? ''),
  };

  const resolvedUrl = Object.entries(replacements).reduce(
    (value, [token, replacement]) => replaceToken(value, token, replacement),
    template.trim()
  );

  try {
    const requestAccessUrl = new URL(resolvedUrl);

    if (!REQUEST_ACCESS_ALLOWED_PROTOCOLS.has(requestAccessUrl.protocol)) {
      return undefined;
    }

    return requestAccessUrl.toString();
  } catch {
    return undefined;
  }
};
