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
import type {
  FieldOrGroup,
  Fields,
  OldJsonItem,
  OldJsonTree,
} from '@react-awesome-query-builder/ui';
import { isBoolean, isUndefined } from 'lodash';
import { EntityReferenceFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import type {
  EsBoolQuery,
  EsExistsQuery,
  EsTerm,
  EsWildCard,
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { generateUUID } from './StringUtils';
import { QUERY_BUILDER_CONJUNCTION } from './queryBuilder/types';

export const JSONLOGIC_FIELDS_TO_IGNORE_SPLIT = [
  EntityReferenceFields.EXTENSION,
  EntityReferenceFields.SERVICE,
  EntityReferenceFields.DATABASE,
  EntityReferenceFields.DATABASE_SCHEMA,
];

export enum JSONLOGIC_OPERATORS {
  OR = 'or',
  NOT = 'not',
}

type FieldWithSubFields = FieldOrGroup & { subfields: Fields };

export const resolveFieldType = (
  fields: Fields | undefined,
  field: string
): string | undefined => {
  if (!fields) {
    return '';
  }

  const fieldParts = field.split('.');
  let currentField = fields?.[fieldParts[0]];

  if (!currentField) {
    return undefined;
  }

  for (let i = 1; i < fieldParts.length; i++) {
    if (i === 1 && (currentField as FieldWithSubFields)?.subfields) {
      const remainingPath = fieldParts.slice(1).join('.');
      const remainingField = (currentField as FieldWithSubFields).subfields[
        remainingPath
      ];
      if (remainingField?.type) {
        return remainingField.type;
      }
    }

    if (!(currentField as FieldWithSubFields)?.subfields?.[fieldParts[i]]) {
      return undefined;
    }
    currentField = (currentField as FieldWithSubFields).subfields[
      fieldParts[i]
    ] as FieldOrGroup;
  }

  return currentField?.type;
};

export const getSelectEqualsNotEqualsProperties = (
  parentPath: Array<string>,
  field: string,
  value: string,
  operator: string
) => {
  const id = generateUUID();
  const isEqualNotEqualOp = ['equal', 'not_equal'].includes(operator);
  const equalityValueType = isBoolean(value) ? ['boolean'] : ['text'];
  const membershipValueType = Array.isArray(value)
    ? ['multiselect']
    : ['select'];
  const valueType = isEqualNotEqualOp ? equalityValueType : membershipValueType;
  const listValues = Array.isArray(value)
    ? value.map((item) => ({ key: item, value: item, children: item }))
    : [{ key: value, value, children: value }];

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: field,
        operator,
        value: [value],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: valueType,
        asyncListValues: isEqualNotEqualOp ? undefined : listValues,
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getSelectAnyInProperties = (
  parentPath: Array<string>,
  termObjects: Array<EsTerm>
) => {
  const values = termObjects.map(
    (termObject) => Object.values(termObject.term)[0]
  );
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: Object.keys(termObjects[0].term)[0],
        operator: 'select_any_in',
        value: [values],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: ['multiselect'],
        asyncListValues: values.map((value) => ({
          key: value,
          value,
          children: value,
        })),
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getSelectNotAnyInProperties = (
  parentPath: Array<string>,
  termObjects: QueryFieldInterface[]
) => {
  const values = termObjects.map(
    (termObject) =>
      Object.values((termObject?.bool?.must_not as EsTerm)?.term)[0]
  );
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: Object.keys((termObjects[0].bool?.must_not as EsTerm).term)[0],
        operator: 'select_not_any_in',
        value: [values],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: ['multiselect'],
        asyncListValues: values.map((value) => ({
          key: value,
          value,
          children: value,
        })),
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getCommonFieldProperties = (
  parentPath: Array<string>,
  field: string,
  operator: string,
  value?: string
) => {
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field,
        operator,
        value: isUndefined(value) ? [] : [value.replaceAll(/(^\*)|(\*$)/g, '')],
        valueSrc: isUndefined(value) ? [] : ['value'],
        operatorOptions: null,
        valueType: isUndefined(value) ? [] : ['text'],
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getEqualFieldProperties = (
  parentPath: Array<string>,
  value: boolean
) => {
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: 'deleted',
        operator: 'equal',
        value: [value],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: ['boolean'],
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getOperator = (
  fieldType: string | undefined,
  isNot: boolean
): string => {
  switch (fieldType) {
    case 'text':
    case 'boolean':
      return isNot ? 'not_equal' : 'equal';
    default:
      return isNot ? 'select_not_equals' : 'select_equals';
  }
};

type QueryFilterRecurse = (
  parentPath: Array<string>,
  queryFilter: QueryFieldInterface[],
  fields?: Fields
) => Record<string, unknown>;

type QueryFilterBranchHandler = (
  curr: QueryFieldInterface,
  parentPath: Array<string>,
  fields: Fields | undefined,
  recurse: QueryFilterRecurse
) => Record<string, unknown> | undefined;

const matchDeletedTerm: QueryFilterBranchHandler = (curr, parentPath) => {
  if (isUndefined(curr.term?.deleted)) {
    return undefined;
  }

  return getEqualFieldProperties(parentPath, curr.term?.deleted as boolean);
};

const matchTerm: QueryFilterBranchHandler = (curr, parentPath, fields) => {
  if (isUndefined(curr.term)) {
    return undefined;
  }
  const [field, value] = Object.entries(curr.term)[0];
  const fieldType = resolveFieldType(fields, field);
  const op = getOperator(fieldType, false);

  return getSelectEqualsNotEqualsProperties(
    parentPath,
    field,
    value as string,
    op
  );
};

const matchMustNotTerm: QueryFilterBranchHandler = (
  curr,
  parentPath,
  fields
) => {
  if (isUndefined((curr.bool?.must_not as QueryFieldInterface)?.term)) {
    return undefined;
  }
  const value = Object.values((curr.bool?.must_not as EsTerm)?.term)[0];
  const key = Object.keys((curr.bool?.must_not as EsTerm)?.term)[0];
  const fieldType = resolveFieldType(fields, key);
  const op = getOperator(fieldType, true);

  return getSelectEqualsNotEqualsProperties(
    parentPath,
    key,
    value as string,
    Array.isArray(value) ? 'select_not_any_in' : op
  );
};

const matchShouldTerm: QueryFilterBranchHandler = (curr, parentPath) => {
  if (
    isUndefined(
      ((curr.bool?.should as QueryFieldInterface[])?.[0] as EsTerm)?.term
    )
  ) {
    return undefined;
  }

  return getSelectAnyInProperties(parentPath, curr?.bool?.should as EsTerm[]);
};

const matchShouldMustNotTerm: QueryFilterBranchHandler = (curr, parentPath) => {
  if (
    isUndefined(
      (
        (curr.bool?.should as QueryFieldInterface[])?.[0]?.bool
          ?.must_not as EsTerm
      )?.term
    )
  ) {
    return undefined;
  }

  return getSelectNotAnyInProperties(
    parentPath,
    curr?.bool?.should as QueryFieldInterface[]
  );
};

const matchMustNotExists: QueryFilterBranchHandler = (curr, parentPath) => {
  if (
    isUndefined((curr.bool?.must_not as QueryFieldInterface)?.exists?.field)
  ) {
    return undefined;
  }

  return getCommonFieldProperties(
    parentPath,
    (curr.bool?.must_not as QueryFieldInterface)?.exists?.field as string,
    'is_null'
  );
};

const matchExists: QueryFilterBranchHandler = (curr, parentPath) => {
  if (isUndefined(curr.exists?.field)) {
    return undefined;
  }

  return getCommonFieldProperties(
    parentPath,
    (curr.exists as EsExistsQuery).field,
    'is_not_null'
  );
};

const matchWildcard: QueryFilterBranchHandler = (curr, parentPath) => {
  if (isUndefined((curr as EsWildCard).wildcard)) {
    return undefined;
  }

  return getCommonFieldProperties(
    parentPath,
    Object.keys((curr as EsWildCard).wildcard)[0],
    'like',
    Object.values((curr as EsWildCard).wildcard)[0]?.value
  );
};

const matchMustNotWildcard: QueryFilterBranchHandler = (curr, parentPath) => {
  if (isUndefined((curr.bool?.must_not as EsWildCard)?.wildcard)) {
    return undefined;
  }

  return getCommonFieldProperties(
    parentPath,
    Object.keys((curr.bool?.must_not as EsWildCard)?.wildcard)[0],
    'not_like',
    Object.values((curr.bool?.must_not as EsWildCard)?.wildcard)[0]?.value
  );
};

const matchBoolMust: QueryFilterBranchHandler = (
  curr,
  parentPath,
  fields,
  recurse
) => {
  if (isUndefined((curr.bool as EsBoolQuery)?.must)) {
    return undefined;
  }

  return recurse(
    parentPath,
    (curr.bool as EsBoolQuery).must as QueryFieldInterface[],
    fields
  );
};

const CUSTOM_PROPERTIES_PATH = 'customPropertiesTyped';
const CUSTOM_PROPERTY_NAME_KEY = `${CUSTOM_PROPERTIES_PATH}.name`;
const CUSTOM_PROPERTY_VALUE_PREFIX = `${CUSTOM_PROPERTIES_PATH}.`;

/** How the value clause states its condition. */
type CustomPropertyShape =
  | 'exists'
  | 'term'
  | 'wildcard'
  | 'regexp'
  | 'match'
  | 'range';

interface CustomPropertyClause {
  /** The property as written into `customPropertiesTyped.name`. */
  name: string;
  shape: CustomPropertyShape;
  /** The typed value field read: `stringValue`, `longValue`, `start`, … */
  valueField?: string;
  value?: unknown;
  range?: Record<string, unknown>;
  negated: boolean;
}

type UnknownRecord = Record<string, unknown>;

const asClauseArray = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) {
    return value as UnknownRecord[];
  }

  return isUndefined(value) ? [] : [value as UnknownRecord];
};

const firstEntry = (value: unknown): [string, unknown] | undefined =>
  Object.entries((value ?? {}) as UnknownRecord)[0];

const toValueField = (key: string): string =>
  key.startsWith(CUSTOM_PROPERTY_VALUE_PREFIX)
    ? key.slice(CUSTOM_PROPERTY_VALUE_PREFIX.length)
    : key;

type ParsedValueClause = Pick<
  CustomPropertyClause,
  'shape' | 'valueField' | 'value' | 'range'
>;

/** Each shape states its value differently, so the reader rides on the key. */
const VALUE_CLAUSE_READERS: Array<
  [
    CustomPropertyShape,
    (body: unknown) => Pick<CustomPropertyClause, 'value' | 'range'>
  ]
> = [
  ['term', (body) => ({ value: body })],
  ['wildcard', (body) => ({ value: (body as { value?: unknown })?.value })],
  ['regexp', (body) => ({ value: (body as { value?: unknown })?.value })],
  ['match', (body) => ({ value: (body as { query?: unknown })?.query })],
  ['range', (body) => ({ range: body as UnknownRecord })],
];

const readValueClause = (
  clause: UnknownRecord
): ParsedValueClause | undefined => {
  for (const [shape, read] of VALUE_CLAUSE_READERS) {
    const entry = firstEntry(clause[shape]);

    if (entry) {
      return { shape, valueField: toValueField(entry[0]), ...read(entry[1]) };
    }
  }

  return undefined;
};

/** Reads one `nested` custom-property query, or nothing if it is not one. */
const readNestedCustomProperty = (
  clause: UnknownRecord | undefined
): Omit<CustomPropertyClause, 'negated'> | undefined => {
  const nested = clause?.nested as
    | { path?: string; query?: UnknownRecord }
    | undefined;

  if (nested?.path !== CUSTOM_PROPERTIES_PATH || !nested.query) {
    return undefined;
  }

  // `is_not_null` writes the name term on its own, with no value clause.
  const bareName = (nested.query.term as UnknownRecord)?.[
    CUSTOM_PROPERTY_NAME_KEY
  ];

  if (!isUndefined(bareName)) {
    return { name: String(bareName), shape: 'exists' };
  }

  const must = asClauseArray((nested.query.bool as EsBoolQuery)?.must);
  const nameClause = must.find(
    (entry) =>
      !isUndefined((entry.term as UnknownRecord)?.[CUSTOM_PROPERTY_NAME_KEY])
  );

  if (!nameClause) {
    return undefined;
  }

  const name = String(
    (nameClause.term as UnknownRecord)[CUSTOM_PROPERTY_NAME_KEY]
  );
  const valueClause = must.find((entry) => entry !== nameClause);
  const parsed = valueClause ? readValueClause(valueClause) : undefined;

  return parsed ? { name, ...parsed } : { name, shape: 'exists' };
};

/** A range fans out over the typed value fields; any branch describes it. */
const readCustomPropertyClause = (
  clause: UnknownRecord | undefined,
  negated = false
): CustomPropertyClause | undefined => {
  const direct = readNestedCustomProperty(clause);

  if (direct) {
    return { ...direct, negated };
  }

  const bool = clause?.bool as EsBoolQuery | undefined;

  if (!bool) {
    return undefined;
  }

  for (const branch of asClauseArray(bool.should)) {
    const parsed = readNestedCustomProperty(branch);

    if (parsed) {
      return { ...parsed, negated };
    }
  }

  if (negated) {
    return undefined;
  }

  for (const inner of asClauseArray(bool.must_not)) {
    const parsed = readCustomPropertyClause(inner, true);

    if (parsed) {
      return parsed;
    }
  }

  return undefined;
};

/**
 * The config key for a property, below `extension`. The query carries the base
 * name; the key extends it with the suffix its type needs (`.keyword`,
 * `.displayName.keyword`, `.start`), so it is matched on that prefix.
 */
const findExtensionField = (
  fields: Fields | undefined,
  name: string,
  valueField?: string
): { key: string; scope: string } | undefined => {
  const subfields = (fields?.extension as FieldWithSubFields | undefined)
    ?.subfields;

  if (!subfields) {
    return undefined;
  }

  // Explore groups by entity type; a pinned builder exposes them directly.
  const scopes: Array<[string, Fields]> = [['', subfields]];
  Object.entries(subfields).forEach(([key, definition]) => {
    const nested = (definition as FieldWithSubFields)?.subfields;

    if (nested) {
      scopes.push([key, nested]);
    }
  });

  const candidates = scopes.flatMap(([scope, scopeFields]) =>
    Object.keys(scopeFields)
      .filter((key) => key === name || key.startsWith(`${name}.`))
      .map((key) => ({ key, scope }))
  );

  if (candidates.length === 0) {
    return undefined;
  }

  const preferred = [
    name,
    `${name}.keyword`,
    ...(valueField ? [`${name}.${valueField}`] : []),
  ];

  return (
    candidates.find((candidate) => preferred.includes(candidate.key)) ??
    candidates.slice().sort((a, b) => a.key.length - b.key.length)[0]
  );
};

/** Equality and containment name themselves per field type, not per query. */
const CUSTOM_PROPERTY_EQUALITY_OPERATORS: Record<string, [string, string]> = {
  select: ['select_equals', 'select_not_equals'],
  multiselect: ['multiselect_equals', 'multiselect_not_equals'],
};

const CUSTOM_PROPERTY_CONTAINS_OPERATORS: Record<string, [string, string]> = {
  select: ['like', 'not_like'],
  multiselect: ['multiselect_contains', 'multiselect_not_contains'],
};

const pickOperator = (
  pairs: Record<string, [string, string]>,
  fallback: [string, string],
  fieldType: string | undefined,
  negated: boolean
): string => (pairs[fieldType ?? ''] ?? fallback)[negated ? 1 : 0];

const RANGE_BOUND_OPERATORS: Array<[string[], string]> = [
  [['gte', 'lte'], 'between'],
  [['lt'], 'less'],
  [['lte'], 'less_or_equal'],
  [['gt'], 'greater'],
  [['gte'], 'greater_or_equal'],
];

const readRange = (
  range: UnknownRecord,
  negated: boolean
): { operator: string; value: unknown[] } | undefined => {
  const bounds = RANGE_BOUND_OPERATORS.find(([keys]) =>
    keys.every((key) => !isUndefined(range[key]))
  );

  if (!bounds) {
    return undefined;
  }

  const [keys, operator] = bounds;

  return {
    operator: operator === 'between' && negated ? 'not_between' : operator,
    value: keys.map((key) => range[key]),
  };
};

const stripWildcards = (value: unknown): string =>
  String(value ?? '').replace(/^\*|\*$/g, '');

/** The rule a parsed clause describes, or nothing if it describes none. */
const toCustomPropertyRule = (
  parsed: CustomPropertyClause,
  fieldType: string | undefined
): { operator: string; value: unknown[] } | undefined => {
  const { shape, negated, value, range } = parsed;

  if (shape === 'exists') {
    return { operator: negated ? 'is_null' : 'is_not_null', value: [] };
  }

  if (shape === 'range') {
    return range ? readRange(range, negated) : undefined;
  }

  if (shape === 'wildcard') {
    return {
      operator: pickOperator(
        CUSTOM_PROPERTY_CONTAINS_OPERATORS,
        ['like', 'not_like'],
        fieldType,
        negated
      ),
      value: [stripWildcards(value)],
    };
  }

  if (shape === 'regexp') {
    return { operator: 'regexp', value: [value] };
  }

  return {
    operator: pickOperator(
      CUSTOM_PROPERTY_EQUALITY_OPERATORS,
      ['equal', 'not_equal'],
      fieldType,
      negated
    ),
    value: [value],
  };
};

/** The clause a `bool.must` envelope wraps, minus the `entityType` scope. */
const unwrapCustomPropertyEnvelope = (
  clause: UnknownRecord
): UnknownRecord | undefined => {
  const must = asClauseArray((clause.bool as EsBoolQuery)?.must);

  if (must.length === 0) {
    return undefined;
  }

  const body = must.find((entry) =>
    isUndefined((entry.term as UnknownRecord)?.entityType)
  );
  const rest = must.filter((entry) => entry !== body);

  return body &&
    rest.every(
      (entry) => !isUndefined((entry.term as UnknownRecord)?.entityType)
    )
    ? body
    : undefined;
};

/**
 * Nests a rule in one `rule_group` per level of its field, the way RAQB does —
 * the canvas draws a Field control per wrapper, so a flat rule left the first
 * control blank.
 */
const wrapInDrillGroups = (
  parentPath: Array<string>,
  levels: string[],
  rule: OldJsonItem
): Record<string, OldJsonItem> => {
  const level = levels[0];

  if (isUndefined(level)) {
    return {
      [rule.id as string]: {
        ...rule,
        path: [...parentPath, rule.id as string],
      },
    } as unknown as Record<string, OldJsonItem>;
  }

  const id = generateUUID();

  return {
    [id]: {
      type: 'rule_group',
      id,
      properties: {
        conjunction: QUERY_BUILDER_CONJUNCTION.AND,
        not: false,
        field: level,
        fieldSrc: 'field',
      },
      children1: wrapInDrillGroups([...parentPath, id], levels.slice(1), rule),
      path: [...parentPath, id],
    } as OldJsonItem,
  } as Record<string, OldJsonItem>;
};

const matchCustomProperty: QueryFilterBranchHandler = (
  curr,
  parentPath,
  fields
) => {
  const clause = curr as unknown as UnknownRecord;
  const parsed =
    readCustomPropertyClause(clause) ??
    readCustomPropertyClause(unwrapCustomPropertyEnvelope(clause));

  if (!parsed) {
    return undefined;
  }

  const found = findExtensionField(fields, parsed.name, parsed.valueField);

  if (!found) {
    return undefined;
  }

  const extension = EntityReferenceFields.EXTENSION as string;
  // Explore's per-entity-type grouping adds a level between `extension` and
  // the property; a pinned builder has none.
  const levels = found.scope
    ? [extension, `${extension}.${found.scope}`]
    : [extension];
  const field = [...levels.slice(-1), found.key].join('.');
  const fieldType = resolveFieldType(fields, field);
  const rule = toCustomPropertyRule(parsed, fieldType);

  if (!rule) {
    return undefined;
  }

  const id = generateUUID();

  return wrapInDrillGroups(parentPath, levels, {
    type: 'rule',
    id,
    properties: {
      field,
      operator: rule.operator,
      value: rule.value,
      valueSrc: rule.value.map(() => 'value'),
      operatorOptions: null,
      valueType: rule.value.map(() => fieldType ?? 'text'),
    },
  } as OldJsonItem);
};

// Order matters: mirrors the original if/else-if cascade — first matching
// handler wins, exactly like the original exclusive branches.
//
// `matchCustomProperty` leads: a custom-property clause is a `bool.must` whose
// companion `entityType` term `matchTerm` would otherwise claim, and a `nested`
// body every handler below ignores.
const QUERY_FILTER_BRANCH_HANDLERS: QueryFilterBranchHandler[] = [
  matchCustomProperty,
  matchDeletedTerm,
  matchTerm,
  matchMustNotTerm,
  matchShouldTerm,
  matchShouldMustNotTerm,
  matchMustNotExists,
  matchExists,
  matchWildcard,
  matchMustNotWildcard,
  matchBoolMust,
];

const withoutCustomPropertyScope = (
  queryFilter: QueryFieldInterface[]
): QueryFieldInterface[] => {
  const isEntityTypeScope = (clause: QueryFieldInterface) =>
    !isUndefined(
      ((clause as unknown as UnknownRecord).term as UnknownRecord)?.entityType
    );

  const hasCustomProperty = queryFilter.some(
    (clause) =>
      !isEntityTypeScope(clause) &&
      !isUndefined(readCustomPropertyClause(clause as unknown as UnknownRecord))
  );

  return hasCustomProperty
    ? queryFilter.filter((clause) => !isEntityTypeScope(clause))
    : queryFilter;
};

export const getJsonTreePropertyFromQueryFilter = (
  parentPath: Array<string>,
  queryFilter: QueryFieldInterface[],
  fields?: Fields
) => {
  const convertedObj = withoutCustomPropertyScope(queryFilter).reduce(
    (acc, curr: QueryFieldInterface): Record<string, unknown> => {
      for (const matchBranch of QUERY_FILTER_BRANCH_HANDLERS) {
        const branchResult = matchBranch(
          curr,
          parentPath,
          fields,
          getJsonTreePropertyFromQueryFilter
        );
        if (branchResult) {
          return { ...acc, ...branchResult };
        }
      }

      return acc;
    },
    {} as Record<string, unknown>
  );

  return convertedObj;
};

export const getJsonTreeFromQueryFilter = (
  queryFilter: QueryFilterInterface,
  fields?: Fields
): OldJsonTree => {
  try {
    const id1 = generateUUID();
    const id2 = generateUUID();
    const mustFilters = queryFilter?.query?.bool?.must as QueryFieldInterface[];

    if (!mustFilters?.length) {
      return {} as OldJsonTree;
    }

    const innerMust = (mustFilters[0]?.bool as EsBoolQuery)?.must as
      | QueryFieldInterface[]
      | undefined;

    return {
      type: 'group',
      properties: { conjunction: QUERY_BUILDER_CONJUNCTION.AND, not: false },
      children1: {
        [id2]: {
          type: 'group',
          properties: {
            conjunction: QUERY_BUILDER_CONJUNCTION.AND,
            not: false,
          },
          children1: getJsonTreePropertyFromQueryFilter(
            [id1, id2],
            innerMust ?? mustFilters,
            fields
          ),
          id: id2,
          path: [id1, id2],
        } as OldJsonItem,
      },
      id: id1,
    };
  } catch {
    return {} as OldJsonTree;
  }
};

export interface ElasticsearchQuery {
  bool?: {
    must?: ElasticsearchQuery[];
    should?: ElasticsearchQuery[];
    filter?: ElasticsearchQuery[];
    must_not?: ElasticsearchQuery | ElasticsearchQuery[];
    minimum_should_match?: number;
  };
  nested?: {
    path: string;
    query: ElasticsearchQuery;
  };
  term?: {
    [key: string]: string | number | boolean;
  };
  exists?: {
    field: string;
  };
  wildcard?: {
    [key: string]: Record<string, string> | string;
  };
  match?: {
    [key: string]: string | number | boolean;
  };
}

export interface JsonLogic {
  [key: string]: unknown;
}

const flattenAndClauses = (clauses: JsonLogic[]): JsonLogic[] => {
  return clauses.reduce((acc: JsonLogic[], clause) => {
    if (clause.and) {
      return acc.concat(flattenAndClauses(clause.and as JsonLogic[]));
    }

    return acc.concat(clause);
  }, []);
};

const buildBoolJsonLogic = (
  boolQuery: NonNullable<ElasticsearchQuery['bool']>,
  toJsonLogic: (query: ElasticsearchQuery) => JsonLogic
): JsonLogic => {
  const jsonLogic: JsonLogic = {};

  if (boolQuery.must) {
    const mustClauses = boolQuery.must.map(toJsonLogic);
    jsonLogic.and = flattenAndClauses(mustClauses);
  }

  if (boolQuery.should) {
    jsonLogic.or = boolQuery.should.map(toJsonLogic);
  }

  if (boolQuery.filter) {
    const filterClauses = boolQuery.filter.map(toJsonLogic);
    jsonLogic.and = ((jsonLogic.and as JsonLogic[]) || []).concat(
      flattenAndClauses(filterClauses)
    );
  }

  if (boolQuery.must_not) {
    const mustNotArray = Array.isArray(boolQuery.must_not)
      ? boolQuery.must_not
      : [boolQuery.must_not];

    const mustNotClauses = mustNotArray.map((q) => ({
      '!': toJsonLogic(q),
    }));

    jsonLogic.and = ((jsonLogic.and as JsonLogic[]) || []).concat(
      flattenAndClauses(mustNotClauses)
    );
  }

  return jsonLogic;
};

const buildTermJsonLogic = (
  termQuery: NonNullable<ElasticsearchQuery['term']>
): JsonLogic => {
  const [field, value] = Object.entries(termQuery)[0];
  const op = Array.isArray(value) ? 'in' : '==';

  if (field.includes('.')) {
    const [parentField, childField] = field.split('.');

    const shouldIgnoreSplit =
      JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
        parentField as EntityReferenceFields
      ) ||
      JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(field as EntityReferenceFields);

    return shouldIgnoreSplit
      ? { '==': [{ var: field }, value] }
      : {
          some: [{ var: parentField }, { [op]: [{ var: childField }, value] }],
        };
  }

  return { '==': [{ var: field }, value] };
};

const buildExistsJsonLogic = (
  existsQuery: NonNullable<ElasticsearchQuery['exists']>
): JsonLogic => {
  const { field } = existsQuery;

  if (field.includes('.')) {
    const [parentField] = field.split('.');

    return {
      '!!': {
        var: JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
          parentField as EntityReferenceFields
        )
          ? field
          : parentField,
      },
    };
  }

  return {
    '!!': { var: field },
  };
};

const buildWildcardJsonLogic = (
  wildcardQuery: NonNullable<ElasticsearchQuery['wildcard']>
): JsonLogic => {
  const field = Object.keys(wildcardQuery)[0];
  const value = (wildcardQuery[field] as Record<string, string>).value;

  if (field.includes('.')) {
    const [parentField, childField] = field.split('.');

    if (
      JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
        parentField as EntityReferenceFields
      )
    ) {
      return {
        in: [{ var: field }, value],
      };
    }

    return {
      some: [
        { var: parentField },
        {
          in: [{ var: childField }, value],
        },
      ],
    };
  } else {
    return {
      in: [{ var: field }, value],
    };
  }
};

export const elasticsearchToJsonLogic = (
  query: ElasticsearchQuery
): JsonLogic => {
  if (query.bool) {
    return buildBoolJsonLogic(query.bool, elasticsearchToJsonLogic);
  }

  if (query.term) {
    return buildTermJsonLogic(query.term);
  }

  if (query.exists) {
    return buildExistsJsonLogic(query.exists);
  }

  if (query.wildcard) {
    return buildWildcardJsonLogic(query.wildcard);
  }

  throw new Error('Unsupported query format');
};

const getNestedFieldKey = (configFields: Fields, searchKey: string) => {
  const searchPattern = `${searchKey}.`;
  for (const key in configFields) {
    if (key.startsWith(searchPattern)) {
      return key;
    }
  }

  return null;
};

type ElasticsearchConverter = (
  logic: JsonLogic,
  configFields: Fields,
  parentField?: string,
  parentOp?: JSONLOGIC_OPERATORS
) => ElasticsearchQuery;

const buildAndElasticsearch = (
  logic: JsonLogic,
  configFields: Fields,
  toElasticsearch: ElasticsearchConverter
): ElasticsearchQuery => ({
  bool: {
    must: [
      {
        bool: {
          must: (logic.and as JsonLogic[]).map((item: JsonLogic) =>
            toElasticsearch(item, configFields)
          ),
        },
      },
    ],
  },
});

const buildOrElasticsearch = (
  logic: JsonLogic,
  configFields: Fields,
  toElasticsearch: ElasticsearchConverter
): ElasticsearchQuery => ({
  bool: {
    should: (logic.or as JsonLogic[]).map((item: JsonLogic) =>
      toElasticsearch(item, configFields, undefined, JSONLOGIC_OPERATORS.OR)
    ),
  },
});

const buildNotElasticsearch = (
  logic: JsonLogic,
  configFields: Fields,
  toElasticsearch: ElasticsearchConverter
): ElasticsearchQuery => ({
  bool: {
    must_not: toElasticsearch(
      logic['!'] as JsonLogic,
      configFields,
      undefined,
      JSONLOGIC_OPERATORS.NOT
    ),
  },
});

const buildEqualsElasticsearch = (
  logic: JsonLogic,
  parentField?: string,
  parentOp?: JSONLOGIC_OPERATORS
): ElasticsearchQuery => {
  const [field, value] = logic['=='] as [{ var: string }, unknown];
  const fieldVar = parentField ? `${parentField}.${field.var}` : field.var;

  const isOrNotOperator = [
    JSONLOGIC_OPERATORS.OR,
    JSONLOGIC_OPERATORS.NOT,
  ].includes(parentOp as JSONLOGIC_OPERATORS);

  const [parentKey] = field.var.split('.');
  const isSplittableVar =
    typeof field === 'object' && field.var && field.var.includes('.');

  if (
    isSplittableVar &&
    !JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
      parentKey as EntityReferenceFields
    ) &&
    !isOrNotOperator
  ) {
    return {
      bool: {
        must: [
          {
            term: {
              [fieldVar]: value as string | number | boolean,
            },
          },
        ],
      },
    };
  }

  return {
    term: {
      [fieldVar]: value as string | number | boolean,
    },
  };
};

const buildNotEqualsElasticsearch = (
  logic: JsonLogic,
  parentField?: string
): ElasticsearchQuery => {
  const [field, value] = logic['!='] as [{ var: string }, unknown];
  const fieldVar = parentField ? `${parentField}.${field.var}` : field.var;

  return {
    bool: {
      must_not: [
        {
          term: {
            [fieldVar]: value as string | number | boolean,
          },
        },
      ],
    },
  };
};

const buildExistsElasticsearch = (
  logic: JsonLogic,
  configFields: Fields
): ElasticsearchQuery => {
  const field = Array.isArray(logic['!!'])
    ? (logic['!!'][0] as { var: string }).var
    : (logic['!!'] as { var: string }).var;
  const fieldVal = getNestedFieldKey(configFields, field);

  return {
    exists: {
      field: fieldVal || field,
    },
  };
};

const buildSomeElasticsearch = (
  logic: JsonLogic,
  configFields: Fields,
  toElasticsearch: ElasticsearchConverter
): ElasticsearchQuery | undefined => {
  const [arrayField, condition] = logic.some as [{ var: string }, JsonLogic];
  if (typeof arrayField === 'object' && arrayField.var) {
    return toElasticsearch(condition, configFields, arrayField.var);
  }

  return undefined;
};

const buildInElasticsearch = (
  logic: JsonLogic,
  parentField?: string
): ElasticsearchQuery => {
  const [field, value] = logic.in as [{ var: string }, unknown];
  const fieldVar = parentField ? `${parentField}.${field.var}` : field.var;

  return {
    term: {
      [fieldVar]: value as string | number | boolean,
    },
  };
};

type JsonLogicHandler = (
  logic: JsonLogic,
  configFields: Fields,
  toElasticsearch: ElasticsearchConverter,
  parentField?: string,
  parentOp?: JSONLOGIC_OPERATORS
) => ElasticsearchQuery | undefined;

// Order matters: mirrors the original if-cascade — first matching key wins.
// A handler returning `undefined` (only possible for `some`) falls through to
// the next entry, exactly like the original code continuing past a failed
// inner check without a `return`.
const JSON_LOGIC_HANDLERS: Array<
  [(logic: JsonLogic) => boolean, JsonLogicHandler]
> = [
  [
    (logic) => Boolean(logic.and),
    (logic, configFields, toElasticsearch) =>
      buildAndElasticsearch(logic, configFields, toElasticsearch),
  ],
  [
    (logic) => Boolean(logic.or),
    (logic, configFields, toElasticsearch) =>
      buildOrElasticsearch(logic, configFields, toElasticsearch),
  ],
  [
    (logic) => Boolean(logic['!']),
    (logic, configFields, toElasticsearch) =>
      buildNotElasticsearch(logic, configFields, toElasticsearch),
  ],
  [
    (logic) => Boolean(logic['==']),
    (logic, _configFields, _toElasticsearch, parentField, parentOp) =>
      buildEqualsElasticsearch(logic, parentField, parentOp),
  ],
  [
    (logic) => Boolean(logic['!=']),
    (logic, _configFields, _toElasticsearch, parentField) =>
      buildNotEqualsElasticsearch(logic, parentField),
  ],
  [
    (logic) => Boolean(logic['!!']),
    (logic, configFields) => buildExistsElasticsearch(logic, configFields),
  ],
  [
    (logic) => Boolean(logic.some),
    (logic, configFields, toElasticsearch) =>
      buildSomeElasticsearch(logic, configFields, toElasticsearch),
  ],
  [
    (logic) => Boolean(logic.in),
    (logic, _configFields, _toElasticsearch, parentField) =>
      buildInElasticsearch(logic, parentField),
  ],
];

export const jsonLogicToElasticsearch = (
  logic: JsonLogic,
  configFields: Fields,
  parentField?: string,
  parentOp?: JSONLOGIC_OPERATORS
): ElasticsearchQuery => {
  for (const [matches, handle] of JSON_LOGIC_HANDLERS) {
    if (matches(logic)) {
      const result = handle(
        logic,
        configFields,
        jsonLogicToElasticsearch,
        parentField,
        parentOp
      );
      if (result) {
        return result;
      }
    }
  }

  throw new Error('Unsupported JSON Logic format');
};

export const addEntityTypeFilter = (
  qFilter: QueryFilterInterface,
  entityType: string
): QueryFilterInterface => {
  if (entityType === EntityType.ALL) {
    return qFilter;
  }

  if (Array.isArray((qFilter.query?.bool as EsBoolQuery)?.must)) {
    (qFilter.query?.bool?.must as QueryFieldInterface[])?.push({
      bool: {
        must: [
          {
            term: {
              'entityType.keyword': entityType,
            },
          },
        ],
      },
    });

    return qFilter;
  }

  if (Array.isArray((qFilter.query?.bool as EsBoolQuery)?.should)) {
    return {
      ...qFilter,
      query: {
        bool: {
          must: [
            qFilter.query,
            { term: { 'entityType.keyword': entityType } },
          ] as QueryFieldInterface[],
        },
      },
    } as QueryFilterInterface;
  }

  return qFilter;
};

export const getEntityTypeAggregationFilter = (
  qFilter: QueryFilterInterface,
  entityType: string | string[]
): QueryFilterInterface => {
  if (entityType === EntityType.ALL) {
    return qFilter;
  }

  if (Array.isArray((qFilter.query?.bool as EsBoolQuery)?.must)) {
    const firstMustBlock = (
      qFilter.query?.bool?.must as QueryFieldInterface[]
    )[0];
    if (firstMustBlock?.bool?.must) {
      const entityTypes = Array.isArray(entityType) ? entityType : [entityType];
      entityTypes.forEach((type) => {
        (firstMustBlock?.bool?.must as QueryFieldInterface[])?.push({
          term: {
            'entityType.keyword': type,
          },
        });
      });
    }
  }

  return qFilter;
};

export const migrateJsonLogic = (
  jsonLogic: Record<string, unknown>
): Record<string, unknown> => {
  const FIELD_MAPPING: Record<string, string> = {
    [EntityReferenceFields.OWNERS]: 'fullyQualifiedName',
    [EntityReferenceFields.REVIEWERS]: 'fullyQualifiedName',
    [EntityReferenceFields.TAG]: 'tagFqn',
  };

  const isVarObject = (value: unknown): value is { var: string } => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }

    return (
      'var' in value &&
      typeof (value as Record<string, unknown>)['var'] === 'string'
    );
  };

  /**
   * An old table-property rule, written from the flat field it used to use.
   * `rows` is an array, so a dotted var resolves to nothing and the rule
   * evaluated false for every row; `some` asks the same question correctly.
   */
  const migrateTableRowsField = (node: JsonLogic): JsonLogic | undefined => {
    if (Array.isArray(node)) {
      return undefined;
    }

    const entries = Object.entries(node);

    if (entries.length !== 1) {
      return undefined;
    }

    const [operator, argument] = entries[0];
    // `some` already asks about the array, and a conjunction is not a rule.
    if (['some', 'all', 'none', 'and', 'or'].includes(operator)) {
      return undefined;
    }

    const operand = Array.isArray(argument) ? argument[0] : argument;

    if (!isVarObject(operand)) {
      return undefined;
    }

    const match = /^(extension\..+\.rows)\.([^.]+)$/.exec(operand.var);

    if (!match) {
      return undefined;
    }

    const [, rowsPath, column] = match;
    const columnVar = { var: column };

    return {
      some: [
        { var: rowsPath },
        {
          [operator]: Array.isArray(argument)
            ? [columnVar, ...argument.slice(1)]
            : columnVar,
        },
      ],
    } as JsonLogic;
  };

  const migrateNode = (node: JsonLogic): JsonLogic => {
    if (node === null || typeof node !== 'object') {
      return node;
    }
    if (!Array.isArray(node) && '!!' in node && isVarObject(node['!!'])) {
      const varName = node['!!'].var;
      const mappedField = FIELD_MAPPING[varName];
      if (mappedField) {
        return {
          some: [{ var: varName }, { '!=': [{ var: mappedField }, null] }],
        };
      }
    }
    const migratedRows = migrateTableRowsField(node);

    if (migratedRows) {
      return migratedRows;
    }

    if (Array.isArray(node)) {
      return node.map(migrateNode) as unknown as JsonLogic;
    }
    const result: Record<string, JsonLogic> = {};
    for (const key in node) {
      result[key] = migrateNode(node[key] as JsonLogic);
    }

    return result;
  };

  return migrateNode(jsonLogic) as Record<string, unknown>;
};

export const getFieldsByKeys = (
  keys: EntityReferenceFields[],
  mapFields: Record<string, FieldOrGroup>
): Record<string, FieldOrGroup> => {
  const filteredFields: Record<string, FieldOrGroup> = {};

  keys.forEach((key) => {
    if (mapFields[key]) {
      filteredFields[key] = mapFields[key];
    }
  });

  return filteredFields;
};
