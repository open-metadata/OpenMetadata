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

  if (fieldName.startsWith('extension.') && fieldName.split('.').length >= 3) {
    const parts = fieldName.split('.');
    entityType = parts[1];
    actualFieldName = `${parts[0]}.${parts.slice(2).join('.')}`;
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

  // For nested extension fields, combine with entityType filter
  if (isNestedExtensionField && entityType) {
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
        return {
          bool: {
            should: value[0].map((val) =>
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
        return {
          bool: {
            should: value[0].map((val) =>
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
