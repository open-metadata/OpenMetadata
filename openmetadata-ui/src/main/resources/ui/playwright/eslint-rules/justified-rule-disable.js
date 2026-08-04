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

const DISABLE_DIRECTIVE = /eslint-disable(?:-next-line|-line)?\s+([^\n]*)/;
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
    },
  },

  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = DISABLE_DIRECTIVE.exec(comment.value);

          if (!match || !TARGET_RULE.test(match[1])) {
            continue;
          }

          if (!match[1].includes('--')) {
            context.report({ node: comment, messageId: 'unjustified' });
          }
        }
      },
    };
  },
};
