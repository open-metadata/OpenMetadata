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
/* eslint-disable no-undef */

/*
 * This script is a modified version of https://github.com/ukrbublik/react-awesome-query-builder/blob/5.1.2/modules/export/elasticSearch.js
 * with small improvements.
 */

import { Utils as extendConfigUtils } from '@react-awesome-query-builder/core';

export const ES_7_SYNTAX = 'ES_7_SYNTAX';
export const ES_6_SYNTAX = 'ES_6_SYNTAX';

const EXACT_MATCH_OPERATORS = [
  'equal',
  'not_equal',
  'select_equals',
  'select_not_equals',
  'multiselect_equals',
  'multiselect_not_equals',
];

const NEGATED_OPERATORS = [
  'not_equal',
  'not_between',
  'not_like',
  'select_not_equals',
  'multiselect_not_equals',
  'multiselect_not_contains',
];

const RANGEABLE_OM_TYPES = [
  'integer',
  'number',
  'timestamp',
  'date-cp',
  'dateTime-cp',
  'time-cp',
];

/**
 * Converts a string representation of top_left and bottom_right cords to
 * a ES geo_point required for query
 *
 * @param {string} geoPointString - comma separated string of lat/lon coods
 * @returns {{top_left: {lon: number, lat: number}, bottom_right: {lon: number, lat: number}}}
 *  - ES geoPoint formatted object
 * @private
 */
function buildEsGeoPoint(geoPointString) {
  if (geoPointString === null) {
    return null;
  }

  const coordsNumberArray = geoPointString.split(',').map(Number);

  return {
    top_left: {
      lat: coordsNumberArray[0],
      lon: coordsNumberArray[1],
    },
    bottom_right: {
      lat: coordsNumberArray[2],
      lon: coordsNumberArray[3],
    },
  };
}

/**
 * Converts a dateTime string from the query builder to a ES range formatted object
 *
 * @param {string} dateTime - dateTime formatted string
 * @param {string} operator - query builder operator type, see constants.js and query builder docs
 * @returns {{lt: string}|{lte: string}|{gte: string}|{gte: string, lte: string}|undefined} - ES range query parameter
 *
 * @private
 */
// A whole day, for operators that compare against a single date.
const buildEsDayRange = (dateTime) => ({
  gte: ''.concat(dateTime, '||/d'),
  lte: ''.concat(dateTime, '||+1d'),
});

// Operator -> range builder. A Map rather than an object literal: `operator`
// arrives from the query-builder config, and a plain object would resolve
// inherited keys such as `toString` to a function and call it.
// todo: move this logic into config
const ES_RANGE_BY_OPERATOR = new Map([
  ['on_date', buildEsDayRange], // todo: not used
  ['not_on_date', buildEsDayRange],
  ['equal', buildEsDayRange],
  ['select_equals', buildEsDayRange],
  ['not_equal', buildEsDayRange],
  ['less_or_equal', (dateTime) => ({ lte: ''.concat(dateTime) })],
  ['greater_or_equal', (dateTime) => ({ gte: ''.concat(dateTime) })],
  ['greater', (dateTime) => ({ gte: ''.concat(dateTime) })],
  ['less', (dateTime) => ({ lt: ''.concat(dateTime) })],
]);

function buildEsRangeParameters(value, operator) {
  // -- if value is greater than 1 then we assume this is a between operator : BUG this is wrong,
  // a selectable list can have multiple values
  if (value.length > 1) {
    return {
      gte: ''.concat(value[0]),
      lte: ''.concat(value[1]),
    };
  } // -- if value is only one we assume this is a date time query for a specific day

  const dateTime = value[0]; // TODO: Rethink about this part, what if someone adds a new type of opperator

  const buildRange = ES_RANGE_BY_OPERATOR.get(operator);

  return buildRange ? buildRange(dateTime) : undefined;
}

/**
 * Builds the DSL parameters for a Wildcard query
 *
 * @param {string} value - The match value
 * @returns {{value: string}} - The value = value parameter surrounded with * on each end
 * @private
 */
function buildEsWildcardParameters(value) {
  return {
    value: '*' + value + '*',
  };
}

/**
 * Takes the match type string from awesome query builder like 'greater_or_equal' and
 * returns the ES occurrence required for bool queries
 *
 * @param {string} combinator - query group type or rule condition
 * @param {bool} not
 * @returns {string} - ES occurrence type. See constants.js
 * @private
 */
function determineOccurrence(combinator, not) {
  // todo: move into config, like mongoConj
  switch (combinator) {
    case 'AND':
      return not ? 'must_not' : 'must';
    // -- AND

    case 'OR':
      return not ? 'should_not' : 'should';
    // -- OR

    case 'NOT':
      return not ? 'must' : 'must_not';
    // -- NOT AND

    default:
      return undefined;
  }
}

function buildRegexpParameters(value) {
  return {
    value: value,
    case_insensitive: true,
  };
}

function determineField(fieldName) {
  // todo: ElasticSearchTextField - not used
  // return config.fields[fieldName].ElasticSearchTextField || fieldName;
  return fieldName;
}

/**
 * Strips parameters the user has not filled in yet. `JSON.stringify` drops `undefined` values, so
 * a clause built from them collapses to `{"term":{}}` — which Elasticsearch and OpenSearch both
 * reject outright, failing the whole search rather than the one incomplete row.
 *
 * @param {object} parameters - The DSL parameters built for a single rule
 * @returns {object|undefined} - The entered parameters, or undefined when the rule is incomplete
 * @private
 */
function definedParameters(parameters) {
  if (!parameters) {
    return undefined;
  }

  const entered = Object.entries(parameters).filter(
    ([, parameter]) => parameter !== undefined
  );

  return entered.length ? Object.fromEntries(entered) : undefined;
}

function buildParameters(
  queryType,
  value,
  operator,
  fieldName,
  config,
  syntax
) {
  const textField = determineField(fieldName);
  switch (queryType) {
    case 'filter':
      // todo: elasticSearchScript - not used
      return {
        script: config.operators[operator].elasticSearchScript(
          fieldName,
          value
        ),
      };

    case 'exists':
      return { field: fieldName };

    case 'match':
      return { [textField]: value[0] };

    case 'term':
      return syntax === ES_7_SYNTAX
        ? {
            [fieldName]: {
              value: value[0],
            },
          }
        : { [fieldName]: value[0] };

    // todo: not used
    // need to add geo type into RAQB or remove this code
    case 'geo_bounding_box':
      return { [fieldName]: buildEsGeoPoint(value[0]) };

    case 'range':
      return { [fieldName]: buildEsRangeParameters(value, operator) };

    case 'wildcard':
      return { [fieldName]: buildEsWildcardParameters(value[0]) };

    case 'regexp':
      return { [fieldName]: buildRegexpParameters(value[0]) };

    default:
      return undefined;
  }
}

/**
 * Extracts the base property name from a potentially nested field path.
 * Complex custom property types (entityReference, timeInterval, hyperlink, etc.)
 * have nested paths like "userref.displayName.keyword" or "timeInterval.start".
 * This function strips those suffixes to get the base property name.
 *
 * Examples:
 *   - "userref.displayName.keyword" -> "userref" (entityReference)
 *   - "timeInterval.start" -> "timeInterval" (timeInterval)
 *   - "link.url.keyword" -> "link.url" (hyperlink-cp)
 *   - "link.displayText.keyword" -> "link.displayText" (hyperlink-cp)
 *   - "mytable.rows.col1.keyword" -> "mytable.rows.col1" (table-cp)
 *   - "mystring.keyword" -> "mystring" (string)
 *   - "myenum.keyword" -> "myenum" (enum)
 *
 * @param {string} propertyName - The full property name with potential nested path
 * @returns {string} - The base property name
 * @private
 */
function getBasePropertyName(propertyName) {
  // Handle table-cp pattern: propertyName.rows.columnName.keyword -> propertyName.rows.columnName
  // Backend stores separate entries for each column with names like "propertyName.rows.columnName"
  const tableMatch = propertyName.match(/^([^.]+\.rows\.[^.]+)/);
  if (tableMatch) {
    return tableMatch[1];
  }

  // Handle hyperlink fields - keep .url or .displayText suffix, only strip .keyword
  // Backend stores these as separate entries with names like "propertyName.url" and "propertyName.displayText"
  if (propertyName.includes('.url')) {
    return propertyName.replace('.keyword', '');
  }
  if (propertyName.includes('.displayText')) {
    return propertyName.replace('.keyword', '');
  }

  // Known nested field suffixes for complex custom property types
  const nestedSuffixes = [
    '.displayName.keyword',
    '.displayName',
    '.name.keyword',
    '.name',
    '.fullyQualifiedName.keyword',
    '.fullyQualifiedName',
    '.start',
    '.end',
    '.keyword',
  ];

  let baseName = propertyName;
  for (const suffix of nestedSuffixes) {
    if (baseName.endsWith(suffix)) {
      baseName = baseName.slice(0, -suffix.length);

      break;
    }
  }

  return baseName;
}

/**
 * Maps an OpenMetadata custom property type (from the field config) to the
 * fieldType / nestedField the ES query builder uses. This is unambiguous because
 * the type comes from the registry — unlike path-based parsing which is
 * ambiguous when property names contain dots (e.g. `owner.name`).
 *
 * @param {string} omPropertyType - OpenMetadata property type
 * @param {string} propertyName - The full property name (used for timeInterval start/end disambiguation)
 * @returns {{ fieldType: string, nestedField: string|null }|null} - Mapping, or null if no mapping
 * @private
 */
function getFieldTypeInfoFromOmType(omPropertyType, propertyName) {
  if (!omPropertyType) {
    return null;
  }
  switch (omPropertyType) {
    case 'entityReference':
    case 'array<entityReference>':
      return { fieldType: 'entityReference', nestedField: 'refName' };
    case 'hyperlink-cp':
      return { fieldType: 'hyperlink', nestedField: 'stringValue' };
    case 'table-cp':
      return { fieldType: 'table', nestedField: 'stringValue' };
    case 'timeInterval':
      if (propertyName.endsWith('.end')) {
        return { fieldType: 'timeInterval', nestedField: 'end' };
      }

      return { fieldType: 'timeInterval', nestedField: 'start' };
    default:
      // For string, integer, number, timestamp, enum, markdown, sqlQuery,
      // date-cp, dateTime-cp, time-cp etc., fall through to default behaviour.
      return { fieldType: 'default', nestedField: null };
  }
}

/**
 * Determines the field type and appropriate ES field mapping from the property name.
 *
 * @param {string} propertyName - The full property name with potential nested path
 * @returns {{ fieldType: string, nestedField: string|null }} - Field type and nested field to query
 * @private
 */
function getFieldTypeInfo(propertyName) {
  // TimeInterval fields: propertyName.start or propertyName.end
  if (propertyName.endsWith('.start')) {
    return { fieldType: 'timeInterval', nestedField: 'start' };
  }
  if (propertyName.endsWith('.end')) {
    return { fieldType: 'timeInterval', nestedField: 'end' };
  }

  // EntityReference fields: propertyName.displayName.keyword, propertyName.name.keyword, etc.
  // NOTE: These checks use endsWith (not includes) so that property names which
  // legitimately contain `.name` (e.g. a property literally named `random.name.with`)
  // are not misclassified. For full disambiguation when the property name itself
  // is `owner.name`, callers should pass the type via getFieldTypeInfoFromOmType.
  if (
    propertyName.endsWith('.displayName') ||
    propertyName.endsWith('.name') ||
    propertyName.endsWith('.fullyQualifiedName')
  ) {
    return { fieldType: 'entityReference', nestedField: 'refName' };
  }

  // Hyperlink fields: propertyName.url.keyword or propertyName.displayText.keyword
  // Both URL and displayText are now stored in stringValue for wildcard support
  if (propertyName.endsWith('.url') || propertyName.endsWith('.displayText')) {
    return { fieldType: 'hyperlink', nestedField: 'stringValue' };
  }

  // Table-cp fields: propertyName.rows.columnName.keyword
  // Table data is now stored in both stringValue (for wildcard) and textValue (for full-text)
  if (propertyName.includes('.rows.')) {
    return { fieldType: 'table', nestedField: 'stringValue' };
  }

  // Default: string or numeric type (determined by operator)
  return { fieldType: 'default', nestedField: null };
}

/**
 * Looks up the OpenMetadata property type for a custom property from the
 * query builder config. Returns null if not found (e.g. legacy saved filters).
 *
 * @param {object} config - The query builder config
 * @param {string} entityType - Entity type segment (e.g. "table")
 * @param {string} propertyName - Full property path including any sub-field suffix
 * @returns {string|null} - The OM property type, or null
 * @private
 */
function lookupOmPropertyType(config, entityType, propertyName) {
  const extensionGroup = config?.fields?.extension;
  const entityGroup = extensionGroup?.subfields?.[entityType];
  const fieldConfig = entityGroup?.subfields?.[propertyName];

  return fieldConfig?.__omPropertyType ?? null;
}

/**
 * Checks if the operator is a range operator (requires numeric field).
 *
 * @param {string} operator - The query operator
 * @returns {boolean} - True if range operator
 * @private
 */
function isRangeOperator(operator) {
  return [
    'between',
    'not_between',
    'less',
    'less_or_equal',
    'greater',
    'greater_or_equal',
  ].includes(operator);
}

/**
 * Builds a nested query for customPropertiesTyped field.
 *
 * @param {string} propertyName - The base property name
 * @param {string} nestedField - The nested field to query (longValue, stringValue, etc.)
 * @param {any} value - The value to search for
 * @param {string} operator - The query operator
 * @returns {object} - The nested ES query
 * @private
 */
// An unbounded operator yields `{}`, matching the original chain's behaviour of
// leaving the range object untouched when nothing matched.
const TYPED_RANGE_BOUND_BY_OPERATOR = new Map([
  ['less', 'lt'],
  ['less_or_equal', 'lte'],
  ['greater', 'gt'],
  ['greater_or_equal', 'gte'],
]);

const buildTypedRangeQuery = (value, operator) => {
  if (
    (operator === 'between' || operator === 'not_between') &&
    Array.isArray(value) &&
    value.length >= 2
  ) {
    return { gte: value[0], lte: value[1] };
  }

  const bound = TYPED_RANGE_BOUND_BY_OPERATOR.get(operator);

  return bound ? { [bound]: Array.isArray(value) ? value[0] : value } : {};
};

function buildNestedTypedQuery(propertyName, nestedField, value, operator) {
  const mustClauses = [
    { term: { 'customPropertiesTyped.name': propertyName } },
  ];

  // Build the value query based on operator
  if (isRangeOperator(operator)) {
    mustClauses.push({
      range: {
        [`customPropertiesTyped.${nestedField}`]: buildTypedRangeQuery(
          value,
          operator
        ),
      },
    });
  } else {
    // Exact match
    const termValue = Array.isArray(value) ? value[0] : value;
    mustClauses.push({
      term: { [`customPropertiesTyped.${nestedField}`]: termValue },
    });
  }

  return {
    nested: {
      path: 'customPropertiesTyped',
      ignore_unmapped: true,
      query: {
        bool: {
          must: mustClauses,
        },
      },
    },
  };
}

/**
 * Builds an Elasticsearch query for extension (custom property) fields.
 * Uses customPropertiesTyped (nested) for all queries:
 * - Range queries: longValue/doubleValue fields
 * - Exact match: stringValue field
 * - Text search: textValue field
 * - Entity references: refName/refId/refFqn fields
 * - Time intervals: start/end fields
 *
 * @param {string} propertyName - The custom property name (may include nested paths)
 * @param {string} entityType - The entity type (table, topic, etc.)
 * @param {any} value - The value to search for
 * @param {string} operator - The query operator
 * @param {boolean} not - Whether to negate the query
 * @param {string|null} omPropertyType - The OpenMetadata property type from config (preferred over path parsing)
 * @returns {object} - The ES query for custom properties
 * @private
 */
// Wraps a leaf clause in the nested/bool/must shape every customPropertiesTyped
// query shares, alongside the property-name term.
const wrapTypedNestedQuery = (basePropertyName, clause) => ({
  nested: {
    path: 'customPropertiesTyped',
    ignore_unmapped: true,
    query: {
      bool: {
        must: [
          { term: { 'customPropertiesTyped.name': basePropertyName } },
          clause,
        ],
      },
    },
  },
});

const firstIfArray = (value) => (Array.isArray(value) ? value[0] : value);

// Which shape of query an extension field needs. Resolved once so the builder
// below is a lookup rather than a nine-branch chain. Operator wins over field
// type, matching the original order of checks.
const EXTENSION_STRATEGY_BY_OPERATOR = new Map([
  ['like', 'wildcard'],
  ['not_like', 'wildcard'],
  ['multiselect_contains', 'wildcard'],
  ['multiselect_not_contains', 'wildcard'],
  ['regexp', 'regexp'],
  ['is_null', 'exists'],
  ['is_not_null', 'exists'],
]);

const EXTENSION_STRATEGY_BY_FIELD_TYPE = new Map([
  ['timeInterval', 'timeInterval'],
  ['entityReference', 'entityReference'],
  ['hyperlink', 'stringValue'],
  ['table', 'stringValue'],
]);

function getExtensionQueryStrategy(operator, fieldType, nestedField) {
  const byOperator = EXTENSION_STRATEGY_BY_OPERATOR.get(operator);
  if (byOperator) {
    return byOperator;
  }

  // timeInterval, hyperlink and table only route by field type once a nested
  // field resolved; entityReference always does.
  const byFieldType = EXTENSION_STRATEGY_BY_FIELD_TYPE.get(fieldType);
  if (byFieldType && (fieldType === 'entityReference' || nestedField)) {
    return byFieldType;
  }

  if (isRangeOperator(operator)) {
    return 'range';
  }

  return EXACT_MATCH_OPERATORS.includes(operator) ? 'exactMatch' : 'textMatch';
}

// Range query: OR across the typed value fields since we don't know which one
// holds the value. Date/time custom properties are stored only as formatted
// strings in stringValue — sending those into a numeric longValue/doubleValue
// range raises an ES number_format_exception that fails the whole search, so
// route date types to stringValue only.
const DATE_OM_PROPERTY_TYPES = new Set(['date-cp', 'dateTime-cp', 'time-cp']);
const NUMERIC_OM_PROPERTY_TYPES = new Set(['integer', 'number', 'timestamp']);

function buildExtensionRangeQuery(basePropertyName, value, operator, omType) {
  const rangeFields = DATE_OM_PROPERTY_TYPES.has(omType)
    ? ['stringValue']
    : ['longValue', 'doubleValue', 'stringValue'];

  return {
    bool: {
      should: rangeFields.map((field) =>
        buildNestedTypedQuery(basePropertyName, field, value, operator)
      ),
      minimum_should_match: 1,
    },
  };
}

// Exact match: pick the right typed field.
// 1) If we know the OM property type, route directly: numeric types ->
//    longValue/doubleValue, all others -> stringValue. This avoids the bug
//    where a string property storing "123" was queried via longValue.
// 2) Otherwise (legacy callers without config), fall back to value-shape
//    detection.
function buildExtensionExactMatchQuery(basePropertyName, value, omType) {
  const stringValue = String(value);
  const trimmedValue = stringValue.trim();
  const numericValue =
    typeof value === 'number' ? value : parseFloat(trimmedValue);
  const isNumeric =
    !isNaN(numericValue) &&
    isFinite(numericValue) &&
    String(numericValue) === trimmedValue;
  const useNumericField = omType
    ? NUMERIC_OM_PROPERTY_TYPES.has(omType)
    : isNumeric;

  if (useNumericField && isNumeric) {
    return buildNestedTypedQuery(
      basePropertyName,
      stringValue.includes('.') ? 'doubleValue' : 'longValue',
      numericValue,
      'equal'
    );
  }

  return buildNestedTypedQuery(basePropertyName, 'stringValue', value, 'equal');
}

const EXTENSION_QUERY_BUILDERS = new Map([
  [
    // Contains/Not contains: wildcard on stringValue (keyword field). All
    // searchable values are stored in stringValue for wildcard support.
    'wildcard',
    ({ basePropertyName, value }) =>
      wrapTypedNestedQuery(basePropertyName, {
        wildcard: {
          'customPropertiesTyped.stringValue': {
            value: '*' + firstIfArray(value) + '*',
          },
        },
      }),
  ],
  [
    'regexp',
    ({ basePropertyName, value }) =>
      wrapTypedNestedQuery(basePropertyName, {
        regexp: {
          'customPropertiesTyped.stringValue': {
            value: firstIfArray(value),
            case_insensitive: true,
          },
        },
      }),
  ],
  [
    'timeInterval',
    ({ basePropertyName, nestedField, value, operator }) =>
      buildNestedTypedQuery(basePropertyName, nestedField, value, operator),
  ],
  [
    'entityReference',
    ({ basePropertyName, value, operator }) =>
      buildNestedTypedQuery(basePropertyName, 'refName', value, operator),
  ],
  [
    // Hyperlink/Table: values are stored in stringValue for exact/wildcard
    // matching.
    'stringValue',
    ({ basePropertyName, value, operator }) =>
      buildNestedTypedQuery(basePropertyName, 'stringValue', value, operator),
  ],
  [
    'range',
    ({ basePropertyName, value, operator, omPropertyType }) =>
      buildExtensionRangeQuery(
        basePropertyName,
        value,
        operator,
        omPropertyType
      ),
  ],
  [
    'exactMatch',
    ({ basePropertyName, value, omPropertyType }) =>
      buildExtensionExactMatchQuery(basePropertyName, value, omPropertyType),
  ],
  [
    // Default text search: match query on textValue.
    'textMatch',
    ({ basePropertyName, value }) =>
      wrapTypedNestedQuery(basePropertyName, {
        match: {
          'customPropertiesTyped.textValue': {
            query: firstIfArray(value),
            operator: 'and',
          },
        },
      }),
  ],
]);

const withEntityTypeFilter = (mainQuery, entityType) => ({
  bool: {
    must: [
      mainQuery,
      {
        term: {
          entityType: entityType,
        },
      },
    ],
  },
});

function buildExtensionQuery(
  propertyName,
  entityType,
  value,
  operator,
  not,
  omPropertyType
) {
  const basePropertyName = getBasePropertyName(propertyName);
  // Prefer the type from the registry config (unambiguous) and fall back to
  // path-based parsing for legacy callers that don't pass the type.
  const { fieldType, nestedField } =
    getFieldTypeInfoFromOmType(omPropertyType, propertyName) ??
    getFieldTypeInfo(propertyName);

  const strategy = getExtensionQueryStrategy(operator, fieldType, nestedField);

  // Existence check: query if the property name exists in
  // customPropertiesTyped. Handled ahead of the rest so it works for all field
  // types, and it never takes the negation wrapper below.
  if (strategy === 'exists') {
    const existsQuery = {
      nested: {
        path: 'customPropertiesTyped',
        ignore_unmapped: true,
        query: {
          term: { 'customPropertiesTyped.name': basePropertyName },
        },
      },
    };
    // Negate for is_null (field should NOT exist), but not when reversed from
    // is_not_null.
    const shouldNegateExists =
      (operator === 'is_null' && !not) || (operator === 'is_not_null' && not);

    return withEntityTypeFilter(
      shouldNegateExists ? { bool: { must_not: existsQuery } } : existsQuery,
      entityType
    );
  }

  let mainQuery = EXTENSION_QUERY_BUILDERS.get(strategy)({
    basePropertyName,
    nestedField,
    value,
    operator,
    omPropertyType,
  });

  // Wrap in must_not if negated
  if (not || NEGATED_OPERATORS.includes(operator)) {
    mainQuery = {
      bool: {
        must_not: mainQuery.nested ? mainQuery : [mainQuery],
      },
    };
  }

  return withEntityTypeFilter(mainQuery, entityType);
}

/**
 * Handles the building of the group portion of the DSL
 *
 * @param {string} fieldName - The name of the field you are building a rule for
 * @param {string} fieldDataType - The type of data this field holds
 * @param {string} value - The value of this rule
 * @param {string} operator - The condition on how the value is matched
 * @param {string} syntax - The version of ElasticSearch syntax to generate
 * @returns {object} - The ES rule
 * @private
 */
// A row the user has half-filled (field and operator picked, nothing typed) carries a value
// list of undefined. Building from it yields a bodiless clause such as `{"term":{}}` once
// JSON.stringify drops the undefined, and both Elasticsearch and OpenSearch reject that
// outright — failing the whole search instead of ignoring the one incomplete row. Operators
// with no value at all (is_null and friends) carry an empty list and stay valid.
function isIncompleteRuleValue(value, operator) {
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => entry === undefined)
  ) {
    return true;
  }

  const isBetweenOperator =
    operator === 'between' || operator === 'not_between';
  if (!isBetweenOperator) {
    return false;
  }

  // between needs both bounds present
  if (!Array.isArray(value) || value.length < 2) {
    return true;
  }

  return value[0] === undefined || value[1] === undefined;
}

// `extension.<entityType>.<propertyPath>` addresses a custom property.
function parseExtensionFieldName(fieldName) {
  const parts = fieldName.split('.');
  if (!fieldName.startsWith('extension.') || parts.length < 3) {
    return {
      actualFieldName: fieldName,
      isNestedExtensionField: false,
      entityType: null,
      extensionPropertyName: null,
    };
  }

  const extensionPropertyName = parts.slice(2).join('.');

  return {
    actualFieldName: `${parts[0]}.${extensionPropertyName}`,
    isNestedExtensionField: true,
    entityType: parts[1],
    extensionPropertyName,
  };
}

// An operator with no query type of its own is expressed as the negation of its
// reverse (e.g. not_equal -> not(equal)).
function resolveRuleOperator(config, operator) {
  let op = operator;
  let opConfig = config.operators[op];
  if (!opConfig) {
    return undefined;
  } // unknown operator

  let { elasticSearchQueryType } = opConfig;
  let not = false;
  if (!elasticSearchQueryType && opConfig.reversedOp) {
    not = true;
    op = opConfig.reversedOp;
    opConfig = config.operators[op];
    ({ elasticSearchQueryType } = opConfig);
  }

  return { op, elasticSearchQueryType, not };
}

// For range operators (between / not_between) the value is a two-element
// array [from, to]. Pass the full array so buildExtensionQuery can build a
// proper gte/lte range query. Numeric types (integer/number/timestamp) query
// longValue/doubleValue. Date types (date-cp/dateTime-cp/time-cp) are stored
// as formatted strings in stringValue; a keyword range is a lexicographic
// comparison, which is chronologically correct for the default big-endian,
// zero-padded formats (e.g. yyyy-MM-dd HH:mm:ss). Other types collapse to
// value[0] since only a single bound is meaningful.
function resolveExtensionValue(op, value, omPropertyType, hasValue) {
  if (!hasValue) {
    return null;
  }

  return op === 'between' && RANGEABLE_OM_TYPES.includes(omPropertyType)
    ? value
    : value[0];
}

function buildWidgetRuleQuery({
  config,
  fieldName,
  actualFieldName,
  op,
  value,
  valueSrc,
  elasticSearchQueryType,
  not,
}) {
  // handle if value 0 has multiple values like a select in a array
  const widget = extendConfigUtils.ConfigUtils.getWidgetForFieldOp(
    config,
    fieldName,
    op,
    valueSrc
  );
  const widgetConfig = config.widgets[widget];
  if (!widgetConfig) {
    return undefined;
  } // unknown widget
  const { elasticSearchFormatValue } = widgetConfig;

  /** In most cases the queryType will be static however in some casese (like between) the query type will change
   * based on the data type. i.e. a between time will be different than between number, date, letters etc... */
  const queryType =
    typeof elasticSearchQueryType === 'function'
      ? elasticSearchQueryType(widget)
      : elasticSearchQueryType;

  if (!queryType) {
    // Not supported
    return undefined;
  }

  /** If a widget has a rule on how to format that data then use that otherwise use default way
   * of determineing search parameters
   * */
  const parameters =
    typeof elasticSearchFormatValue === 'function'
      ? elasticSearchFormatValue(queryType, value, op, actualFieldName, config)
      : buildParameters(queryType, value, op, actualFieldName, config);

  const enteredParameters = definedParameters(parameters);
  if (!enteredParameters) {
    return undefined;
  } // rule is not fully entered

  // Build the main query
  return not
    ? { bool: { must_not: { [queryType]: { ...enteredParameters } } } }
    : { [queryType]: { ...enteredParameters } };
}

// A rule needs a field, an operator and a value before it can produce a clause.
function isRuleEntered(fieldName, operator, value) {
  return Boolean(fieldName) && Boolean(operator) && value !== undefined;
}

// Unary operators carry no value, so they qualify on the operator alone.
function isExtensionRule(parsed, op, hasValue) {
  const isUnaryOperator = op === 'is_null' || op === 'is_not_null';

  return (
    parsed.isNestedExtensionField &&
    Boolean(parsed.entityType) &&
    (hasValue || isUnaryOperator)
  );
}

function buildEsRule(fieldName, value, operator, config, valueSrc) {
  if (!isRuleEntered(fieldName, operator, value)) {
    return undefined;
  } // rule is not fully entered

  if (isIncompleteRuleValue(value, operator)) {
    return undefined;
  }

  // Check if field has custom elasticsearch field mapping or handle extension fields
  const parsedField = parseExtensionFieldName(fieldName);
  const { actualFieldName, entityType, extensionPropertyName } = parsedField;

  const resolvedOperator = resolveRuleOperator(config, operator);
  if (!resolvedOperator) {
    return undefined;
  } // unknown operator
  const { op, elasticSearchQueryType, not } = resolvedOperator;

  // For extension fields, use the new customPropertiesTyped field approach
  // Handle both value-based operators and unary operators (is_null, is_not_null)
  const hasValue = Array.isArray(value) && value.length > 0;
  if (isExtensionRule(parsedField, op, hasValue)) {
    const omPropertyType = lookupOmPropertyType(
      config,
      entityType,
      extensionPropertyName
    );

    return buildExtensionQuery(
      extensionPropertyName,
      entityType,
      resolveExtensionValue(op, value, omPropertyType, hasValue),
      op,
      not,
      omPropertyType
    );
  }

  return buildWidgetRuleQuery({
    config,
    fieldName,
    actualFieldName,
    op,
    value,
    valueSrc,
    elasticSearchQueryType,
    not,
  });
}

/**
 * Handles the building of the group portion of the DSL
 *
 * @param {object} children - The contents of the group
 * @param {string} conjunction - The way the contents of the group are joined together i.e. AND OR
 * @param {bool} not
 * @param {Function} recursiveFxn - The recursive fxn to build the contents of the groups children
 * @param {object} config - The config object
 * @param {string} syntax - The version of ElasticSearch syntax to generate
 * @private
 * @returns {object} - The ES group
 */
function buildEsGroup(
  children,
  conjunction,
  not,
  recursiveFxn,
  config,
  syntax
) {
  if (!children || !children.size) {
    return undefined;
  }
  const childrenArray = children.valueSeq().toArray();
  const occurrence = determineOccurrence(conjunction, not);
  const result = childrenArray
    .map((c) => recursiveFxn(c, config, syntax))
    .filter((v) => v !== undefined);
  if (!result.length) {
    return undefined;
  }
  const resultFlat = result.flat(Infinity);

  if (not) {
    return {
      bool: {
        must_not: resultFlat,
      },
    };
  }

  return {
    bool: {
      [occurrence]: resultFlat,
    },
  };
}

// A multiselect rule holds its options in value[0]; each option becomes its own
// clause. An option the user has not picked yet yields no rule; keeping the hole
// would serialize to a null clause, which the search engines reject.
function buildMultiselectEsRule(field, value, operator, config, valueSrc) {
  const useAndLogic =
    operator === 'multiselect_equals' || operator === 'multiselect_not_equals';

  return {
    bool: {
      [useAndLogic ? 'must' : 'should']: value[0]
        .map((val) => buildEsRule(field, [val], operator, config, valueSrc))
        .filter((rule) => rule !== undefined),
    },
  };
}

function formatEsRuleNode(properties, extendedConfig) {
  const operator = properties.get('operator');
  const field = properties.get('field');
  const fieldSrc = properties.get('fieldSrc');
  const value = properties.get('value')?.toJS();
  const valueSrc = properties.get('valueSrc')?.get(0);

  if (valueSrc === 'func' || fieldSrc === 'func') {
    // -- elastic search doesn't support functions (that is post processing)
    return undefined;
  }

  if (value && Array.isArray(value[0])) {
    return buildMultiselectEsRule(
      field,
      value,
      operator,
      extendedConfig,
      valueSrc
    );
  }

  // extendedConfig, as in every other branch: buildEsRule resolves the field's widget
  // through the config it is given, and a raw one resolves none — so a fully entered
  // condition builds no clause at all when this runs on a rule node directly.
  return buildEsRule(field, value, operator, extendedConfig, valueSrc);
}

// The formatter is passed in rather than referenced directly: buildEsGroup
// recurses through it, and naming the export here would read it before it is
// defined.
function formatEsGroupNode(
  tree,
  properties,
  extendedConfig,
  syntax,
  formatter
) {
  const not = properties.get('not');
  const conjunction =
    properties.get('conjunction') ||
    extendConfigUtils.DefaultUtils.defaultConjunction(extendedConfig);

  return buildEsGroup(
    tree.get('children1'),
    conjunction,
    not,
    formatter,
    extendedConfig,
    syntax
  );
}

export function elasticSearchFormat(tree, config, syntax = ES_6_SYNTAX) {
  try {
    const extendedConfig = extendConfigUtils.ConfigUtils.extendConfig(
      config,
      undefined,
      false
    );
    // -- format the es dsl here
    if (!tree) {
      return undefined;
    }
    const type = tree.get('type');
    const properties = tree.get('properties') || new Map();

    // -- field is null when a new blank rule is added
    if (type === 'rule' && properties.get('field')) {
      return formatEsRuleNode(properties, extendedConfig);
    }

    if (type === 'group' || type === 'rule_group') {
      return formatEsGroupNode(
        tree,
        properties,
        extendedConfig,
        syntax,
        elasticSearchFormat
      );
    }
  } catch {
    return {};
  }
}

/**
 * A rule that produced no clause, or a multiselect wrapper with no options picked, adds no
 * constraint at all.
 *
 * @param {object|undefined} clause - What elasticSearchFormat produced for a single rule
 * @returns {boolean} - Whether the rule ended up constraining nothing
 * @private
 */
function producesNoConstraint(clause) {
  if (!clause) {
    return true;
  }

  const options = clause.bool?.must ?? clause.bool?.should;

  return Array.isArray(options) && options.length === 0;
}

/**
 * Reports whether the tree holds a condition the user started but did not finish — a row naming a
 * field whose value was never entered.
 *
 * Such a row is dropped from the emitted query (a bodiless clause like `{"term":{}}` is rejected by
 * both search engines), so persisting it would silently widen the filter to match everything. The
 * answer comes from asking elasticSearchFormat what the row actually produces, so this check and
 * buildEsRule cannot drift apart.
 *
 * A row with no field picked is deliberately not flagged: that is the query builder's own empty
 * state, which it creates and keeps on its own, and it has always been dropped. Only a row that
 * names a field carries intent that could be silently lost.
 *
 * @param {object} tree - The immutable query-builder tree
 * @param {object} config - The same config passed to elasticSearchFormat
 * @param {string} syntax - The version of ElasticSearch syntax to generate
 * @returns {boolean} - Whether any condition was started but left unfinished
 */
export function hasUnfinishedRule(tree, config, syntax = ES_6_SYNTAX) {
  if (!tree) {
    return false;
  }

  const type = tree.get('type');
  if (type === 'rule') {
    const field = tree.get('properties')?.get('field');

    return (
      Boolean(field) &&
      producesNoConstraint(elasticSearchFormat(tree, config, syntax))
    );
  }

  const children = tree.get('children1');
  if (!children || typeof children.valueSeq !== 'function') {
    return false;
  }

  return children
    .valueSeq()
    .toArray()
    .some((child) => hasUnfinishedRule(child, config, syntax));
}

// Deliberately unlike the Elasticsearch variant above: this one passes the raw
// `config` to buildEsRule, excludes select_not_any_in from the per-option
// expansion, and keeps undefined entries in the clause list.
function buildJsonLogicMultiselectRule(
  field,
  value,
  operator,
  config,
  valueSrc
) {
  const useAndLogic =
    operator === 'multiselect_equals' || operator === 'multiselect_not_equals';

  return {
    bool: {
      [useAndLogic ? 'must' : 'should']: value[0].map((val) =>
        buildEsRule(field, [val], operator, config, valueSrc)
      ),
    },
  };
}

function formatJsonLogicRuleNode(properties, config) {
  const operator = properties.get('operator');
  const field = properties.get('field');
  const fieldSrc = properties.get('fieldSrc');
  const value = properties.get('value')?.toJS();
  const valueSrc = properties.get('valueSrc')?.get(0);

  if (valueSrc === 'func' || fieldSrc === 'func') {
    // -- elastic search doesn't support functions (that is post processing)
    return undefined;
  }

  if (value && Array.isArray(value[0]) && operator !== 'select_not_any_in') {
    return buildJsonLogicMultiselectRule(
      field,
      value,
      operator,
      config,
      valueSrc
    );
  }

  return buildEsRule(field, value, operator, config, valueSrc);
}

function formatJsonLogicGroupNode(
  tree,
  properties,
  extendedConfig,
  config,
  syntax,
  formatter
) {
  const not = properties.get('not');
  const conjunction =
    properties.get('conjunction') ||
    extendConfigUtils.DefaultUtils.defaultConjunction(extendedConfig);

  return buildEsGroup(
    tree.get('children1'),
    conjunction,
    not,
    formatter,
    config,
    syntax
  );
}

export function elasticSearchFormatForJSONLogic(
  tree,
  config,
  syntax = ES_6_SYNTAX
) {
  try {
    const extendedConfig = extendConfig(config, undefined, false);
    // -- format the es dsl here
    if (!tree) {
      return undefined;
    }
    const type = tree.get('type');
    const properties = tree.get('properties') || new Map();

    // -- field is null when a new blank rule is added
    if (type === 'rule' && properties.get('field')) {
      return formatJsonLogicRuleNode(properties, config);
    }

    if (type === 'group' || type === 'rule_group') {
      return formatJsonLogicGroupNode(
        tree,
        properties,
        extendedConfig,
        config,
        syntax,
        elasticSearchFormatForJSONLogic
      );
    }
  } catch {
    return {};
  }
}
