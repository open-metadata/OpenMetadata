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

const containsUuidCall = (node, sourceCode) =>
  /\buuid\s*\(/.test(sourceCode.getText(node));

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require entity names to include a uuid() call',
    },
    schema: [],
    messages: {
      nonUniqueName:
        'A fixed entity name collides with data left by earlier runs or parallel workers. Interpolate uuid(): `pw-table-${uuid()}`.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Property(node) {
        if (node.key?.name !== 'name' && node.key?.value !== 'name') {
          return;
        }

        const value = node.value;
        const isStringish =
          (value.type === 'Literal' && typeof value.value === 'string') ||
          value.type === 'TemplateLiteral';

        if (isStringish && !containsUuidCall(value, sourceCode)) {
          context.report({ node: value, messageId: 'nonUniqueName' });
        }
      },
    };
  },
};
