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

// Anchored to the full trimmed comment body, as ESLint itself recognizes a
// directive: nothing but the directive, optionally a rule list and/or
// ` -- <why>`. Anchoring stops prose that merely mentions "eslint-disable"
// (this file's own doc comments) from being read as a directive. The rule
// list is optional in the grammar — a bare directive disables everything.
const DISABLE_DIRECTIVE =
  /^eslint-disable(?:-next-line|-line)?(?:\s+([\s\S]*))?$/;
const TARGET_RULE = /\b(?:om-)?playwright\//;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a justification comment when disabling a playwright lint rule',
    },
    schema: [],
    messages: {
      unjustified:
        'Disabling a playwright rule requires a justification: append ` -- <why>` to the directive so a reviewer can judge it.',
      blanketDisable:
        'A blanket eslint-disable with no rule list disables every active rule, including every playwright rule — this is never allowed, even with a justification comment. Name the specific rule(s) to disable, each justified with ` -- <why>`.',
    },
  },

  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = DISABLE_DIRECTIVE.exec(comment.value.trim());

          if (!match) {
            continue;
          }

          // Per ESLint's grammar `--` separates the rule list from the
          // justification; an empty rule list disables every rule, justified
          // or not.
          const raw = match[1] || '';
          const dashIndex = raw.indexOf('--');
          const ruleList = (
            dashIndex === -1 ? raw : raw.slice(0, dashIndex)
          ).trim();
          const hasJustification = dashIndex !== -1;

          if (ruleList === '') {
            context.report({ node: comment, messageId: 'blanketDisable' });
            continue;
          }

          if (!TARGET_RULE.test(ruleList)) {
            continue;
          }

          if (!hasJustification) {
            context.report({ node: comment, messageId: 'unjustified' });
          }
        }
      },
    };
  },
};

export default rule;
