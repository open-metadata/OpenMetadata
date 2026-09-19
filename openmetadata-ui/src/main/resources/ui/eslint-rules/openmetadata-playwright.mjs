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
    docs: {
      description:
        'Require waitForAggregation instead of waiting on search/aggregate directly',
    },
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

/**
 * `UserClass.login()` drives the sign-in form: navigate to /signin, wait for it,
 * fill, Tab, fill, click, await the response, await the redirect, dismiss the
 * getting-started dialog, collapse the sidebar. Nine UI interactions on the
 * critical path of a test that is not about signing in, each of them a step that
 * can time out.
 *
 * `UserClass.signIn()` establishes the same session with one POST, and both
 * funnel through the same `completeSignIn`, so the two differ in how the session
 * was established and nothing else. Every sanctioned path — the seeded role
 * pages, the `isolatedUser` fixtures, and `performUserLogin` — goes through it.
 *
 * So `login()` in a spec means one of two things: the spec is testing the form
 * itself, which is legitimate and wants a justified disable, or it is a call
 * that has not been migrated yet.
 *
 * Scope, stated plainly: this flags *authenticating as* a bespoke user, not
 * *creating* one. `new UserClass()` for an owner, reviewer or assignee is
 * ordinary test data and is untouched — flagging it would bury the signal.
 * The implementation modules that must log in (auth.setup, the fixtures, the
 * login helpers) are exempt by path.
 *
 * It runs at `warn`: there are ~290 existing call sites, and a rule whose
 * baseline is most of the corpus teaches nothing. Fix them as you touch them.
 */
const ROLE_FIXTURES = [
  'adminPage',
  'dataConsumerPage',
  'dataStewardPage',
  'ownerPage',
  'editDescriptionPage',
  'editTagsPage',
  'editGlossaryTermPage',
  'viewOnlyPage',
];

/** Modules that build the storage states, or are the login path itself. */
const LOGIN_IMPLEMENTATION_PATHS = [
  'e2e/auth.setup.ts',
  'support/fixtures/userPages.ts',
  'support/fixtures/isolatedUser.ts',
  'e2e/fixtures/pages.ts',
  'utils/user.ts',
  'utils/apiSignIn.ts',
  'utils/admin.ts',
  'support/user/',
];

const preferRolePageFixture = {
  meta: {
    docs: {
      description:
        'Prefer the shared role page fixtures over creating and logging in a bespoke user',
    },
    messages: {
      preferRolePageFixture:
        '`login()` drives the sign-in form — nine UI interactions before this test has done anything. Use `signIn()` instead: same session, same post-sign-in steps, one POST. Better still, take a fixture and let it own the account: one of {{fixtures}} from support/fixtures/userPages (or e2e/fixtures/pages) for a seeded role, or `isolatedUserPage` / `freshUserPage` from support/fixtures/isolatedUser when the test needs its own account — those create and delete it for you, so there is no beforeAll/afterAll bookkeeping to get wrong. If this spec is testing the sign-in form itself, keep `login()` and disable this rule with a reason.',
    },
    schema: [],
    type: 'suggestion',
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, '/');

    if (LOGIN_IMPLEMENTATION_PATHS.some((path) => filename.includes(path))) {
      return {};
    }

    const report = (node) =>
      context.report({
        node,
        messageId: 'preferRolePageFixture',
        data: { fixtures: ROLE_FIXTURES.join(', ') },
      });

    return {
      CallExpression(node) {
        const { callee } = node;

        // `<user>.login(<page>, ...)` — the UserClass login, which takes the
        // page first and may carry trailing options. Requiring a first argument
        // that is not an object literal keeps an unrelated `login({ ... })` on
        // some other client, which takes options rather than a page, out of it.
        const isUserLogin =
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'login' &&
          node.arguments.length > 0 &&
          node.arguments[0].type !== 'ObjectExpression';

        if (isUserLogin) {
          report(node);
        }
      },
    };
  },
};

export default {
  rules: {
    'require-aggregation-wait-helper': requireAggregationWaitHelper,
    'prefer-role-page-fixture': preferRolePageFixture,
  },
};
