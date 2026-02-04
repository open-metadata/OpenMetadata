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

  // todo: move this logic into config
  switch (operator) {
    case 'on_date': // todo: not used
    case 'not_on_date':
    case 'equal':
    case 'select_equals':
    case 'not_equal':
      return {
        gte: ''.concat(dateTime, '||/d'),
        lte: ''.concat(dateTime, '||+1d'),
      };

    case 'less_or_equal':
      return {
        lte: ''.concat(dateTime),
      };

    case 'greater_or_equal':
      return {
        gte: ''.concat(dateTime),
      };

    case 'less':
      return {
        lt: ''.concat(dateTime),
      };

    case 'greater':
      return {
        gte: ''.concat(dateTime),
      };

    default:
      return undefined;
  }
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
  if (
    propertyName.includes('.displayName') ||
    propertyName.includes('.name') ||
    propertyName.includes('.fullyQualifiedName')
  ) {
    return { fieldType: 'entityReference', nestedField: 'refName' };
  }

  // Hyperlink fields: propertyName.url.keyword or propertyName.displayText.keyword
  // Both URL and displayText are now stored in stringValue for wildcard support
  if (propertyName.includes('.url') || propertyName.includes('.displayText')) {
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
function buildNestedTypedQuery(propertyName, nestedField, value, operator) {
  const mustClauses = [
    { term: { 'customPropertiesTyped.name': propertyName } },
  ];

  // Build the value query based on operator
  if (isRangeOperator(operator)) {
    const rangeQuery = {};
    if (operator === 'between' && Array.isArray(value) && value.length >= 2) {
      rangeQuery.gte = value[0];
      rangeQuery.lte = value[1];
    } else if (operator === 'less') {
      rangeQuery.lt = Array.isArray(value) ? value[0] : value;
    } else if (operator === 'less_or_equal') {
      rangeQuery.lte = Array.isArray(value) ? value[0] : value;
    } else if (operator === 'greater') {
      rangeQuery.gt = Array.isArray(value) ? value[0] : value;
    } else if (operator === 'greater_or_equal') {
      rangeQuery.gte = Array.isArray(value) ? value[0] : value;
    }
    mustClauses.push({
      range: { [`customPropertiesTyped.${nestedField}`]: rangeQuery },
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
 * @returns {object} - The ES query for custom properties
 * @private
 */
function buildExtensionQuery(propertyName, entityType, value, operator, not) {
  const basePropertyName = getBasePropertyName(propertyName);
  const { fieldType, nestedField } = getFieldTypeInfo(propertyName);

  let mainQuery;

  // Use customPropertiesTyped for structured queries
  // Handle text search operators first (like, not_like, regexp) - these need special query types
  if (operator === 'like' || operator === 'not_like') {
    // Contains/Not contains: use wildcard query on stringValue (keyword field)
    // All searchable values are now stored in stringValue for wildcard support
    const searchValue = Array.isArray(value) ? value[0] : value;
    mainQuery = {
      nested: {
        path: 'customPropertiesTyped',
        ignore_unmapped: true,
        query: {
          bool: {
            must: [
              { term: { 'customPropertiesTyped.name': basePropertyName } },
              {
                wildcard: {
                  'customPropertiesTyped.stringValue': {
                    value: '*' + searchValue + '*',
                  },
                },
              },
            ],
          },
        },
      },
    };
  } else if (operator === 'regexp') {
    // Regular expression: use regexp query on stringValue
    const searchValue = Array.isArray(value) ? value[0] : value;
    mainQuery = {
      nested: {
        path: 'customPropertiesTyped',
        ignore_unmapped: true,
        query: {
          bool: {
            must: [
              { term: { 'customPropertiesTyped.name': basePropertyName } },
              {
                regexp: {
                  'customPropertiesTyped.stringValue': {
                    value: searchValue,
                    case_insensitive: true,
                  },
                },
              },
            ],
          },
        },
      },
    };
  } else if (operator === 'is_null' || operator === 'is_not_null') {
    // Existence check: query if property name exists in customPropertiesTyped
    // Handle this early to ensure it works for all field types
    const existsQuery = {
      nested: {
        path: 'customPropertiesTyped',
        ignore_unmapped: true,
        query: {
          term: { 'customPropertiesTyped.name': basePropertyName },
        },
      },
    };
    // Negate for is_null (field should NOT exist), but not when reversed from is_not_null
    const shouldNegateExists =
      (operator === 'is_null' && !not) || (operator === 'is_not_null' && not);
    if (shouldNegateExists) {
      mainQuery = {
        bool: {
          must_not: existsQuery,
        },
      };
    } else {
      mainQuery = existsQuery;
    }

    // Return early with entityType filter
    return {
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
    };
  } else if (fieldType === 'timeInterval' && nestedField) {
    // TimeInterval: query start or end field
    mainQuery = buildNestedTypedQuery(
      basePropertyName,
      nestedField,
      value,
      operator
    );
  } else if (fieldType === 'entityReference') {
    // EntityReference: use refName for exact match queries
    mainQuery = buildNestedTypedQuery(
      basePropertyName,
      'refName',
      value,
      operator
    );
  } else if (fieldType === 'hyperlink' && nestedField) {
    // Hyperlink: both URL and displayText are stored in stringValue for exact/wildcard matching
    mainQuery = buildNestedTypedQuery(
      basePropertyName,
      'stringValue',
      value,
      operator
    );
  } else if (fieldType === 'table' && nestedField) {
    // Table: row data is stored in both stringValue (for wildcard) and textValue (for full-text)
    // Use stringValue for exact match queries
    mainQuery = buildNestedTypedQuery(
      basePropertyName,
      'stringValue',
      value,
      operator
    );
  } else if (isRangeOperator(operator)) {
    // Range query: query longValue, doubleValue, and stringValue with OR
    // since we don't know which field the value is stored in
    // (dates are stored as strings, numbers as long/double)
    const longValueQuery = buildNestedTypedQuery(
      basePropertyName,
      'longValue',
      value,
      operator
    );
    const doubleValueQuery = buildNestedTypedQuery(
      basePropertyName,
      'doubleValue',
      value,
      operator
    );
    const stringValueQuery = buildNestedTypedQuery(
      basePropertyName,
      'stringValue',
      value,
      operator
    );
    mainQuery = {
      bool: {
        should: [longValueQuery, doubleValueQuery, stringValueQuery],
        minimum_should_match: 1,
      },
    };
  } else if (
    operator === 'equal' ||
    operator === 'not_equal' ||
    operator === 'select_equals' ||
    operator === 'select_not_equals' ||
    operator === 'multiselect_equals' ||
    operator === 'multiselect_not_equals'
  ) {
    // Exact match: detect numeric values and use appropriate field
    // Note: parseFloat parses partial strings, so we need to check the entire value
    const stringValue = String(value);
    const trimmedValue = stringValue.trim();
    const numericValue =
      typeof value === 'number' ? value : parseFloat(trimmedValue);
    // Check if the entire value is a valid number (parseFloat alone won't catch '05:04:04' -> 5)
    const isNumeric =
      !isNaN(numericValue) &&
      isFinite(numericValue) &&
      String(numericValue) === trimmedValue;

    if (isNumeric) {
      // For numeric values, use longValue (for integers) or doubleValue (for decimals)
      const isDecimal = stringValue.includes('.');
      const nestedField = isDecimal ? 'doubleValue' : 'longValue';
      mainQuery = buildNestedTypedQuery(
        basePropertyName,
        nestedField,
        numericValue,
        'equal'
      );
    } else {
      // For string values, use stringValue
      mainQuery = buildNestedTypedQuery(
        basePropertyName,
        'stringValue',
        value,
        'equal'
      );
    }
  } else if (
    operator === 'multiselect_contains' ||
    operator === 'multiselect_not_contains'
  ) {
    // Multiselect contains: use wildcard on stringValue (enum values are stored there)
    const searchValue = Array.isArray(value) ? value[0] : value;
    mainQuery = {
      nested: {
        path: 'customPropertiesTyped',
        ignore_unmapped: true,
        query: {
          bool: {
            must: [
              { term: { 'customPropertiesTyped.name': basePropertyName } },
              {
                wildcard: {
                  'customPropertiesTyped.stringValue': {
                    value: '*' + searchValue + '*',
                  },
                },
              },
            ],
          },
        },
      },
    };
  } else {
    // Default text search: use match query on textValue
    const searchValue = Array.isArray(value) ? value[0] : value;
    mainQuery = {
      nested: {
        path: 'customPropertiesTyped',
        ignore_unmapped: true,
        query: {
          bool: {
            must: [
              { term: { 'customPropertiesTyped.name': basePropertyName } },
              {
                match: {
                  'customPropertiesTyped.textValue': {
                    query: searchValue,
                    operator: 'and',
                  },
                },
              },
            ],
          },
        },
      },
    };
  }

  // Wrap in must_not if negated
  if (
    not ||
    operator === 'not_equal' ||
    operator === 'not_between' ||
    operator === 'not_like' ||
    operator === 'select_not_equals' ||
    operator === 'multiselect_not_equals' ||
    operator === 'multiselect_not_contains'
  ) {
    mainQuery = {
      bool: {
        must_not: mainQuery.nested ? mainQuery : [mainQuery],
      },
    };
  }

  // Combine with entityType filter
  return {
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
  };
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
function buildEsRule(fieldName, value, operator, config, valueSrc) {
  if (!fieldName || !operator || value === undefined) {
    return undefined;
  } // rule is not fully entered

  // Check if field has custom elasticsearch field mapping or handle extension fields
  let actualFieldName = fieldName;
  let isNestedExtensionField = false;
  let entityType = null;
  let extensionPropertyName = null;

  if (fieldName.startsWith('extension.') && fieldName.split('.').length >= 3) {
    const parts = fieldName.split('.');
    entityType = parts[1];
    extensionPropertyName = parts.slice(2).join('.');
    actualFieldName = `${parts[0]}.${extensionPropertyName}`;
    isNestedExtensionField = true;
  }

  let op = operator;
  let opConfig = config.operators[op];
  if (!opConfig) {
    return undefined;
  } // unknown operator
  let { elasticSearchQueryType } = opConfig;

  // not
  let not = false;
  if (!elasticSearchQueryType && opConfig.reversedOp) {
    not = true;
    op = opConfig.reversedOp;
    opConfig = config.operators[op];
    ({ elasticSearchQueryType } = opConfig);
  }

  // For extension fields, use the new customPropertiesTyped field approach
  // Handle both value-based operators and unary operators (is_null, is_not_null)
  const isUnaryOperator = op === 'is_null' || op === 'is_not_null';
  const hasValue = Array.isArray(value) && value.length > 0;
  if (isNestedExtensionField && entityType && (hasValue || isUnaryOperator)) {
    return buildExtensionQuery(
      extensionPropertyName,
      entityType,
      hasValue ? value[0] : null,
      op,
      not
    );
  }

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
  let queryType;
  if (typeof elasticSearchQueryType === 'function') {
    queryType = elasticSearchQueryType(widget);
  } else {
    queryType = elasticSearchQueryType;
  }

  if (!queryType) {
    // Not supported
    return undefined;
  }

  /** If a widget has a rule on how to format that data then use that otherwise use default way
   * of determineing search parameters
   * */
  let parameters;
  if (typeof elasticSearchFormatValue === 'function') {
    parameters = elasticSearchFormatValue(
      queryType,
      value,
      op,
      actualFieldName,
      config
    );
  } else {
    parameters = buildParameters(queryType, value, op, actualFieldName, config);
  }

  // Build the main query
  let mainQuery;
  if (not) {
    mainQuery = {
      bool: {
        must_not: {
          [queryType]: { ...parameters },
        },
      },
    };
  } else {
    mainQuery = {
      [queryType]: { ...parameters },
    };
  }

  return mainQuery;
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

    if (type === 'rule' && properties.get('field')) {
      // -- field is null when a new blank rule is added
      const operator = properties.get('operator');
      const field = properties.get('field');
      const fieldSrc = properties.get('fieldSrc');
      const value = properties.get('value')?.toJS();
      const valueSrc = properties.get('valueSrc')?.get(0);

      if (valueSrc === 'func' || fieldSrc === 'func') {
        // -- elastic search doesn't support functions (that is post processing)
        return;
      }

      if (value && Array.isArray(value[0])) {
        // Check if this is a multiselect equals operator that should use AND logic
        const useAndLogic =
          operator === 'multiselect_equals' ||
          operator === 'multiselect_not_equals';

        return {
          bool: {
            [useAndLogic ? 'must' : 'should']: value[0].map((val) =>
              buildEsRule(
                field,
                [val],
                operator,
                extendedConfig,
                valueSrc,
                syntax
              )
            ),
          },
        };
      } else {
        return buildEsRule(field, value, operator, config, valueSrc, syntax);
      }
    }

    if (type === 'group' || type === 'rule_group') {
      const not = properties.get('not');
      let conjunction = properties.get('conjunction');
      if (!conjunction) {
        conjunction =
          extendConfigUtils.DefaultUtils.defaultConjunction(extendedConfig);
      }
      const children = tree.get('children1');

      return buildEsGroup(
        children,
        conjunction,
        not,
        elasticSearchFormat,
        extendedConfig,
        syntax
      );
    }
  } catch {
    return {};
  }
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

    if (type === 'rule' && properties.get('field')) {
      // -- field is null when a new blank rule is added
      const operator = properties.get('operator');
      const field = properties.get('field');
      const fieldSrc = properties.get('fieldSrc');
      const value = properties.get('value')?.toJS();
      const valueSrc = properties.get('valueSrc')?.get(0);

      if (valueSrc === 'func' || fieldSrc === 'func') {
        // -- elastic search doesn't support functions (that is post processing)
        return;
      }

      if (
        value &&
        Array.isArray(value[0]) &&
        operator !== 'select_not_any_in'
      ) {
        // Check if this is a multiselect equals operator that should use AND logic
        const useAndLogic =
          operator === 'multiselect_equals' ||
          operator === 'multiselect_not_equals';

        return {
          bool: {
            [useAndLogic ? 'must' : 'should']: value[0].map((val) =>
              buildEsRule(field, [val], operator, config, valueSrc)
            ),
          },
        };
      } else {
        return buildEsRule(field, value, operator, config, valueSrc);
      }
    }

    if (type === 'group' || type === 'rule_group') {
      const not = properties.get('not');
      let conjunction = properties.get('conjunction');
      if (!conjunction) {
        conjunction =
          extendConfigUtils.DefaultUtils.defaultConjunction(extendedConfig);
      }
      const children = tree.get('children1');

      return buildEsGroup(
        children,
        conjunction,
        not,
        elasticSearchFormatForJSONLogic,
        config,
        syntax
      );
    }
  } catch {
    return {};
  }
}
