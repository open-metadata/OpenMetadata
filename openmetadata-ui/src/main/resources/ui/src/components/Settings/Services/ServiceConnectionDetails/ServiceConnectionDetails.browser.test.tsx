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
/**
 * Every connector's stored secrets stay masked on the read-only Connection tab.
 *
 * This view walks each connection schema itself to decide which values are secrets, so a
 * secret in a shape it does not follow renders as readable text. Rather than listing connectors, the test walks the
 * same schemas the view loads, finds every `format: password` field (through `$ref`,
 * nested objects and oneOf/anyOf branches) and renders a config holding just that secret.
 * A new connector or a new secret field is covered without touching this file.
 */
import { setWith } from 'lodash';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { APIServiceType } from '../../../../generated/entity/services/apiService';
import { DashboardServiceType } from '../../../../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../../../../generated/entity/services/databaseService';
import { DriveServiceType } from '../../../../generated/entity/services/driveService';
import { MessagingServiceType } from '../../../../generated/entity/services/messagingService';
import { MetadataServiceType } from '../../../../generated/entity/services/metadataService';
import { MlModelServiceType } from '../../../../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../../../../generated/entity/services/pipelineService';
import { SearchServiceType } from '../../../../generated/entity/services/searchService';
import { Type as SecurityServiceType } from '../../../../generated/entity/services/securityService';
import { StorageServiceType } from '../../../../generated/entity/services/storageService';
import { ConfigData } from '../../../../interface/service.interface';
import { renderWithApp } from '../../../../test/browser/renderWithApp';
import { scaled } from '../../../../test/browser/timeouts';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import ServiceConnectionDetails from './ServiceConnectionDetails.component';

const SECRET = 'stored-secret-value';
// A plain value rendered alongside the secret, so the test knows the view has rendered.
const PROBE_KEY = 'renderProbe';
const PROBE_VALUE = 'rendered';
const MAX_DEPTH = 12;

type Schema = Record<string, unknown>;
type SchemaLoader = (type: string) => Promise<{ schema: Schema }>;

interface Category {
  serviceCategory: string;
  types: string[];
  load: SchemaLoader;
}

const CATEGORIES: Category[] = [
  {
    serviceCategory: 'databaseServices',
    types: Object.values(DatabaseServiceType),
    load: (type) =>
      serviceUtilClassBase.getDatabaseServiceConfig(
        type as DatabaseServiceType
      ),
  },
  {
    serviceCategory: 'dashboardServices',
    types: Object.values(DashboardServiceType),
    load: (type) =>
      serviceUtilClassBase.getDashboardServiceConfig(
        type as DashboardServiceType
      ),
  },
  {
    serviceCategory: 'messagingServices',
    types: Object.values(MessagingServiceType),
    load: (type) =>
      serviceUtilClassBase.getMessagingServiceConfig(
        type as MessagingServiceType
      ),
  },
  {
    serviceCategory: 'pipelineServices',
    types: Object.values(PipelineServiceType),
    load: (type) =>
      serviceUtilClassBase.getPipelineServiceConfig(
        type as PipelineServiceType
      ),
  },
  {
    serviceCategory: 'mlmodelServices',
    types: Object.values(MlModelServiceType),
    load: (type) =>
      serviceUtilClassBase.getMlModelServiceConfig(type as MlModelServiceType),
  },
  {
    serviceCategory: 'metadataServices',
    types: Object.values(MetadataServiceType),
    load: (type) =>
      serviceUtilClassBase.getMetadataServiceConfig(
        type as MetadataServiceType
      ),
  },
  {
    serviceCategory: 'storageServices',
    types: Object.values(StorageServiceType),
    load: (type) =>
      serviceUtilClassBase.getStorageServiceConfig(type as StorageServiceType),
  },
  {
    serviceCategory: 'searchServices',
    types: Object.values(SearchServiceType),
    load: (type) =>
      serviceUtilClassBase.getSearchServiceConfig(type as SearchServiceType),
  },
  {
    serviceCategory: 'apiServices',
    types: Object.values(APIServiceType),
    load: (type) =>
      serviceUtilClassBase.getAPIServiceConfig(type as APIServiceType),
  },
  {
    serviceCategory: 'securityServices',
    types: Object.values(SecurityServiceType),
    load: (type) =>
      serviceUtilClassBase.getSecurityServiceConfig(
        type as SecurityServiceType
      ),
  },
  {
    serviceCategory: 'driveServices',
    types: Object.values(DriveServiceType),
    load: (type) =>
      serviceUtilClassBase.getDriveServiceConfig(type as DriveServiceType),
  },
];

const isRecord = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const resolveRef = (node: Schema, root: Schema): Schema => {
  const ref = node.$ref;
  if (typeof ref !== 'string' || !ref.startsWith('#/')) {
    return node;
  }
  const target = ref
    .slice(2)
    .split('/')
    .reduce<unknown>(
      (current, key) => (isRecord(current) ? current[key] : undefined),
      root
    );

  return isRecord(target) ? target : node;
};

const findSecretPaths = (
  node: unknown,
  root: Schema,
  path: string[] = [],
  depth = 0
): string[][] => {
  if (!isRecord(node) || depth > MAX_DEPTH) {
    return [];
  }
  const resolved = resolveRef(node, root);
  if (resolved.format === 'password') {
    return [path];
  }
  const properties = isRecord(resolved.properties) ? resolved.properties : {};
  const branches = resolved.oneOf ?? resolved.anyOf;

  return [
    ...Object.entries(properties).flatMap(([key, child]) =>
      findSecretPaths(child, root, [...path, key], depth + 1)
    ),
    ...(Array.isArray(branches) ? branches : []).flatMap((branch) =>
      findSecretPaths(branch, root, path, depth + 1)
    ),
  ];
};

const uniquePaths = (paths: string[][]) => [
  ...new Map(paths.map((path) => [path.join('.'), path])).values(),
];

const readableSecretInputs = () =>
  [...document.querySelectorAll('input')].filter(
    (input) => input.value === SECRET && input.type !== 'password'
  );

const renderSecret = async (
  serviceCategory: string,
  serviceType: string,
  path: string[]
) => {
  const connectionDetails = setWith(
    { [PROBE_KEY]: PROBE_VALUE },
    path,
    SECRET,
    Object
  ) as unknown as ConfigData;

  const view = await renderWithApp(
    <ServiceConnectionDetails
      connectionDetails={connectionDetails}
      serviceCategory={serviceCategory}
      serviceFQN={serviceType}
    />,
    { url: '/connection', path: '/connection' }
  );

  await expect
    .element(page.getByLabelText(PROBE_KEY, { exact: true }), {
      timeout: scaled(10_000),
    })
    .toHaveValue(PROBE_VALUE);

  return view;
};

describe('Service connection details secret masking', () => {
  test.each(CATEGORIES)(
    '$serviceCategory: every stored secret renders masked',
    async ({ serviceCategory, types, load }) => {
      let checked = 0;

      for (const serviceType of types) {
        const { schema } = await load(serviceType);
        const secretPaths = uniquePaths(findSecretPaths(schema, schema));

        for (const path of secretPaths) {
          const view = await renderSecret(serviceCategory, serviceType, path);
          const card = document.querySelector(
            '[data-testid="service-connection-details"]'
          );

          expect
            .soft(
              readableSecretInputs().length,
              `${serviceType}: ${path.join('.')} renders readable`
            )
            .toBe(0);
          expect
            .soft(
              card?.textContent?.includes(SECRET),
              `${serviceType}: ${path.join('.')} renders as text`
            )
            .toBe(false);

          checked++;
          await view.unmount();
        }
      }

      expect(checked).toBeGreaterThan(0);
    },
    scaled(300_000)
  );
});
