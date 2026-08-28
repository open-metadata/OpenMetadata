/*
 *  Copyright 2025 Collate.
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

export type SchemaObject = Record<string, unknown>;
export type RenderableValue = string | number | boolean | unknown[] | undefined;
export type FilterPatternValue = {
  includes?: string[];
  excludes?: string[];
};

export const isSchemaObject = (value: unknown): value is SchemaObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getSchemaObject = (value: unknown): SchemaObject | undefined =>
  isSchemaObject(value) ? value : undefined;

export const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const isRenderableValue = (value: unknown): value is RenderableValue => {
  if (value === undefined || Array.isArray(value)) {
    return true;
  }

  const valueType = typeof value;

  return (
    valueType === 'string' || valueType === 'number' || valueType === 'boolean'
  );
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isOptionalStringArray = (value: unknown): boolean =>
  value === undefined || isStringArray(value);

export const isFilterPatternValue = (
  value: SchemaObject
): value is FilterPatternValue => {
  const includes = value.includes;
  const excludes = value.excludes;

  return (
    isOptionalStringArray(includes) &&
    isOptionalStringArray(excludes) &&
    (includes !== undefined || excludes !== undefined)
  );
};

const getJsonPointerValue = (
  schemaObject: SchemaObject,
  reference: string
): unknown => {
  if (reference === '#') {
    return schemaObject;
  }

  if (!reference.startsWith('#/')) {
    return undefined;
  }

  return reference
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((current, part) => {
      if (isSchemaObject(current)) {
        return current[part];
      }

      if (Array.isArray(current)) {
        const index = Number(part);

        return Number.isInteger(index) ? current[index] : undefined;
      }

      return undefined;
    }, schemaObject);
};

export const resolveSchemaReference = (
  schemaObject: unknown,
  referenceScopes: SchemaObject[]
): SchemaObject | undefined => {
  if (!isSchemaObject(schemaObject)) {
    return undefined;
  }

  let resolvedSchema = schemaObject;
  const visitedReferences = new Set<string>();

  while (true) {
    const reference = getString(resolvedSchema.$ref);

    if (!reference || visitedReferences.has(reference)) {
      return resolvedSchema;
    }

    visitedReferences.add(reference);

    const referencedSchema = referenceScopes
      .map((scope) => getJsonPointerValue(scope, reference))
      .find(isSchemaObject);

    if (!referencedSchema) {
      return resolvedSchema;
    }

    const schemaWithReferenceRemoved = { ...resolvedSchema };
    delete schemaWithReferenceRemoved.$ref;
    resolvedSchema = {
      ...referencedSchema,
      ...schemaWithReferenceRemoved,
    };
  }
};

export const getSchemaObjects = (value: unknown): SchemaObject[] =>
  Array.isArray(value) ? value.filter(isSchemaObject) : [];

type SchemaDiscriminator = {
  key: string;
  value: unknown;
};

const getSchemaDiscriminators = (
  schemaObject: SchemaObject
): SchemaDiscriminator[] => {
  const properties = getSchemaObject(schemaObject.properties);

  if (!properties) {
    return [];
  }

  return Object.entries(properties).flatMap(([key, property]) => {
    const propertySchema = getSchemaObject(property);

    if (!propertySchema) {
      return [];
    }

    if (Object.prototype.hasOwnProperty.call(propertySchema, 'const')) {
      return [{ key, value: propertySchema.const }];
    }

    const enumValues = propertySchema.enum;

    return Array.isArray(enumValues) && enumValues.length === 1
      ? [{ key, value: enumValues[0] }]
      : [];
  });
};

const matchesSchemaDiscriminator = (
  schemaObject: SchemaObject,
  value: SchemaObject
): boolean => {
  return getSchemaDiscriminators(schemaObject).some(
    ({ key, value: expectedValue }) =>
      key in value && expectedValue === value[key]
  );
};

const getStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const getSchemaMatchScore = (
  schemaObject: SchemaObject,
  value: SchemaObject,
  referenceScopes: SchemaObject[],
  depth = 0
): number | undefined => {
  const requiredProperties = getStringArray(schemaObject.required);

  if (requiredProperties.some((key) => !(key in value))) {
    return undefined;
  }

  if (depth > 5) {
    return requiredProperties.length;
  }

  const properties = getSchemaObject(schemaObject.properties);

  if (!properties) {
    return requiredProperties.length;
  }

  return Object.entries(value).reduce((score, [key, nestedValue]) => {
    const propertySchema = getSchemaObject(properties[key]);

    if (!propertySchema) {
      return score;
    }

    const resolvedPropertySchema =
      resolveSchemaReference(propertySchema, [
        schemaObject,
        ...referenceScopes,
      ]) ?? propertySchema;
    const nestedScore = isSchemaObject(nestedValue)
      ? getSchemaMatchScore(
          resolvedPropertySchema,
          nestedValue,
          [resolvedPropertySchema, ...referenceScopes],
          depth + 1
        ) ?? 0
      : 0;

    return score + 1 + nestedScore;
  }, requiredProperties.length);
};

const getStructurallyMatchingSchema = (
  value: SchemaObject,
  schemas: SchemaObject[],
  referenceScopes: SchemaObject[]
): SchemaObject | undefined => {
  const scoredSchemas = schemas
    .map((schemaObject) => ({
      schemaObject,
      score: getSchemaMatchScore(schemaObject, value, referenceScopes),
    }))
    .filter(
      (item): item is { schemaObject: SchemaObject; score: number } =>
        item.score !== undefined
    );
  const highestScore = Math.max(...scoredSchemas.map(({ score }) => score), 0);
  const matchingSchemas = scoredSchemas.filter(
    ({ score }) => score === highestScore
  );

  return highestScore > 0 && matchingSchemas.length === 1
    ? matchingSchemas[0].schemaObject
    : undefined;
};

export const getMatchingOneOfSchema = (
  value: unknown,
  oneOf: SchemaObject[],
  referenceScopes: SchemaObject[]
): SchemaObject | undefined => {
  const valueObject = getSchemaObject(value);

  if (!valueObject) {
    return undefined;
  }

  const resolvedSchemas = oneOf
    .map((schemaObject) =>
      resolveSchemaReference(schemaObject, referenceScopes)
    )
    .filter((schemaObject): schemaObject is SchemaObject =>
      Boolean(schemaObject)
    );

  const hasDiscriminator = resolvedSchemas.some(
    (schemaObject) => getSchemaDiscriminators(schemaObject).length > 0
  );

  if (hasDiscriminator) {
    return resolvedSchemas.find((schemaObject) =>
      matchesSchemaDiscriminator(schemaObject, valueObject)
    );
  }

  return getStructurallyMatchingSchema(
    valueObject,
    resolvedSchemas,
    referenceScopes
  );
};

export const getNestedSchema = ({
  schema,
  schemaContext,
  schemaProperty,
  value,
}: {
  schema: SchemaObject;
  schemaContext: SchemaObject;
  schemaProperty?: SchemaObject;
  value: SchemaObject;
}):
  | {
      schemaContext: SchemaObject;
      schemaPropertyObject: SchemaObject;
    }
  | undefined => {
  const childOneOf = getSchemaObjects(schemaProperty?.oneOf);

  if (childOneOf.length > 0) {
    const selectedOneOfSchema = getMatchingOneOfSchema(value, childOneOf, [
      schemaContext,
      schemaProperty ?? {},
      schema,
    ]);
    const selectedProperties = getSchemaObject(selectedOneOfSchema?.properties);

    return selectedOneOfSchema && selectedProperties
      ? {
          schemaContext: selectedOneOfSchema,
          schemaPropertyObject: selectedProperties,
        }
      : undefined;
  }

  return {
    schemaContext: schemaProperty ?? schemaContext,
    schemaPropertyObject: getSchemaObject(schemaProperty?.properties) ?? {},
  };
};

export const getSchemaProperty = ({
  key,
  schema,
  schemaContext,
  schemaPropertyObject,
}: {
  key: string;
  schema: SchemaObject;
  schemaContext: SchemaObject;
  schemaPropertyObject: SchemaObject;
}): SchemaObject | undefined =>
  resolveSchemaReference(schemaPropertyObject[key], [schemaContext, schema]);
