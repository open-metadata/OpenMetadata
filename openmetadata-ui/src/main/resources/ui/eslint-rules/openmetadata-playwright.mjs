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

const AGGREGATE_ENDPOINT = 'search/aggregate';
const HELPER_MODULE = 'searchAggregation';

/** Mirrors the resolver in openmetadata-performance.mjs. */
const findVariable = (sourceCode, identifier) => {
  let scope = sourceCode.getScope(identifier);

  while (scope) {
    const variable = scope.set.get(identifier.name);

    if (variable) {
      return variable;
    }

    scope = scope.upper;
  }

  return null;
};

/**
 * Source text of the matcher, following an identifier to every value assigned to
 * it in this file — declaration or later assignment, at any scope. A matcher
 * built in another module is out of reach, since ESLint sees one file at a time.
 */
const resolveMatcherText = (argument, sourceCode) => {
  if (argument.type !== 'Identifier') {
    return sourceCode.getText(argument);
  }

  const variable = findVariable(sourceCode, argument);
  const assigned = [
    ...(variable?.defs ?? []).map((def) => def.node?.init),
    ...(variable?.references ?? [])
      .filter((reference) => reference.writeExpr)
      .map((reference) => reference.writeExpr),
  ].filter(Boolean);

  return assigned.map((node) => sourceCode.getText(node)).join('\n');
};

/**
 * A wait naming only the endpoint or the field matches both aggregations a
 * dropdown fires — the one on open and the typed search — so it can resolve on
 * the wrong one (#31859). `waitForAggregation` requires the value that tells
 * them apart.
 */
const requireAggregationWaitHelper = {
  meta: {
    messages: {
      rawAggregationWait:
        'Use waitForAggregation from playwright/utils/searchAggregation instead of waiting on search/aggregate directly — a wait that names only the endpoint or field also matches the dropdown-open request and can resolve early.',
    },
    schema: [],
    type: 'problem',
  },
  create(context) {
    const { sourceCode } = context;

    if (context.filename.includes(HELPER_MODULE)) {
      return {};
    }

    return {
      CallExpression(node) {
        const isWaitForResponse =
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'waitForResponse';

        if (!isWaitForResponse || node.arguments.length === 0) {
          return;
        }

        // The matcher may be a string, template literal or URL predicate, so
        // match on source text rather than evaluating each form. Quotes and
        // concatenation come out first so a path split across literals still
        // reads as one string.
        const matcherText = resolveMatcherText(
          node.arguments[0],
          sourceCode
        ).replace(/['"`+\s]/g, '');

        if (matcherText.includes(AGGREGATE_ENDPOINT)) {
          context.report({ node, messageId: 'rawAggregationWait' });
        }
      },
    };
  },
};

export default {
  rules: {
    'require-aggregation-wait-helper': requireAggregationWaitHelper,
  },
};
