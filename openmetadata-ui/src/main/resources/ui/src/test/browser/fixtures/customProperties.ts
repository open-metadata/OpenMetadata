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
import { applyPatch, deepClone, Operation } from 'fast-json-patch';
import { http, HttpResponse } from 'msw';
import { Category, Type } from '../../../generated/entity/type';
import { Config, CustomProperty } from '../../../generated/type/customProperty';
import { worker } from '../msw';

/**
 * The property types a fresh server seeds (json/data/type/*.json), as
 * `GET /metadata/types?category=field` lists them.
 */
export const FIELD_TYPE_NAMES = [
  'integer',
  'string',
  'markdown',
  'number',
  'duration',
  'email',
  'enum',
  'sqlQuery',
  'timestamp',
  'entityReference',
  'entityReferenceList',
  'timeInterval',
  'time-cp',
  'date-cp',
  'dateTime-cp',
  'table-cp',
  'hyperlink-cp',
] as const;

export type FieldTypeName = (typeof FIELD_TYPE_NAMES)[number];

const fieldTypeId = (name: string) =>
  `7c1d0e2f-0000-4000-8000-${String(
    FIELD_TYPE_NAMES.indexOf(name as FieldTypeName) + 1
  ).padStart(12, '0')}`;

export const FIELD_TYPES: Type[] = FIELD_TYPE_NAMES.map((name) => ({
  id: fieldTypeId(name),
  name,
  fullyQualifiedName: name,
  description: `"${name}" type`,
  category: Category.Field,
}));

/** A custom property of `type`, shaped as the server stores it. */
export const customProperty = (
  type: FieldTypeName,
  name: string,
  config?: string[] | Config | string
): CustomProperty => ({
  name,
  description: `${name} description`,
  propertyType: {
    id: fieldTypeId(type),
    type: 'type',
    name: type,
    fullyQualifiedName: type,
  },
  ...(config === undefined ? {} : { customPropertyConfig: { config } }),
});

/** The config each type gets in the spec (createCustomPropertyForEntity). */
export const SPEC_CONFIG: Partial<
  Record<FieldTypeName, string[] | Config | string>
> = {
  enum: { multiSelect: true, values: ['small', 'medium', 'large'] },
  entityReference: ['user', 'team'],
  entityReferenceList: ['user', 'team'],
  'time-cp': 'HH:mm:ss',
  'date-cp': 'yyyy-MM-dd',
  'dateTime-cp': 'yyyy-MM-dd HH:mm:ss',
  'table-cp': { columns: ['pw-column1', 'pw-column2'] },
};

/** One property of every type, named `cp-<type>`, configured as in the spec. */
export const ONE_OF_EACH: CustomProperty[] = FIELD_TYPE_NAMES.map((type) =>
  customProperty(type, `cp-${type}`, SPEC_CONFIG[type])
);

export const propertyOf = (type: FieldTypeName) =>
  ONE_OF_EACH.find((p) => p.propertyType.name === type) as CustomProperty;

/** `GET /metadata/types/customProperties`: the server's per-type summary. */
export const summaryOf = (property: CustomProperty) => {
  const type = property.propertyType.name ?? '';

  return {
    name: property.name,
    displayName: property.displayName,
    type:
      type === 'entityReferenceList' ? 'array<entityReference>' : type ?? '',
    customPropertyConfig: property.customPropertyConfig,
  };
};

export interface TypeServer {
  /** The entity type as the server holds it now. */
  current: () => Type;
  /** Each property the page added (`PUT /metadata/types/{id}`). */
  added: CustomProperty[];
  /** Each JSON-patch body the page sent to the type. */
  patches: Operation[][];
}

/**
 * Serves the custom properties of `entityType` the way TypeResource does:
 * GET by name, add (PUT) and JSON-patch it, the field types the add form
 * lists, and the per-type summary advanced search builds its fields from.
 */
export const serveEntityType = (
  entityType: string,
  properties: CustomProperty[] = []
): TypeServer => {
  const id = `7c1d0e2f-0000-4000-8000-1${String(entityType.length).padStart(
    11,
    '0'
  )}`;
  let stored: Type = {
    id,
    name: entityType,
    fullyQualifiedName: entityType,
    description: `${entityType} entity type`,
    category: Category.Entity,
    customProperties: deepClone(properties),
  };
  const server: TypeServer = {
    current: () => stored,
    added: [],
    patches: [],
  };

  worker.use(
    http.get('/api/v1/metadata/types', () =>
      HttpResponse.json({
        data: FIELD_TYPES,
        paging: { total: FIELD_TYPES.length },
      })
    ),
    http.get(`/api/v1/metadata/types/name/${entityType}`, () =>
      HttpResponse.json(stored)
    ),
    http.get('/api/v1/metadata/types/customProperties', () =>
      HttpResponse.json({
        [entityType]: (stored.customProperties ?? []).map(summaryOf),
      })
    ),
    http.put(`/api/v1/metadata/types/${id}`, async ({ request }) => {
      const property = (await request.json()) as CustomProperty;
      const type = FIELD_TYPES.find((t) => t.id === property.propertyType.id);
      server.added.push(property);
      stored = {
        ...stored,
        customProperties: [
          ...(stored.customProperties ?? []),
          {
            ...property,
            propertyType: {
              ...property.propertyType,
              name: type?.name,
              fullyQualifiedName: type?.name,
            },
          },
        ],
      };

      return HttpResponse.json(stored);
    }),
    http.patch(`/api/v1/metadata/types/${id}`, async ({ request }) => {
      const ops = (await request.json()) as Operation[];
      server.patches.push(ops);
      stored = applyPatch(deepClone(stored), ops).newDocument;

      return HttpResponse.json(stored);
    })
  );

  return server;
};
