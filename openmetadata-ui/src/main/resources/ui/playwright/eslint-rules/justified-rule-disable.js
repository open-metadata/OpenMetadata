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

'use strict';

// Anchored to the full (trimmed) comment body, mirroring how ESLint itself
// recognizes a directive comment: the comment must consist of nothing but
// the directive, optionally followed by a rule list and/or ` -- <why>`. This
// is what stops the rule from misreading prose that merely *mentions*
// "eslint-disable" (e.g. this file's own doc comments) as a real directive.
// The rule list is optional in the grammar itself: `/* eslint-disable */`
// and `// eslint-disable-next-line` (no rule names) are both valid ESLint
// directives that disable every active rule file-wide or line-wide.
const DISABLE_DIRECTIVE =
  /^eslint-disable(?:-next-line|-line)?(?:\s+([^\n]*))?$/;
const TARGET_RULE = /\b(?:om-)?playwright\//;

module.exports = {
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

          // `--` separates the rule list from the justification text per
          // ESLint's own directive grammar; a rule list of `''` (nothing
          // before `--`, or nothing at all) means every rule is disabled,
          // regardless of whether a justification follows.
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
