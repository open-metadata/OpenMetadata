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

const RAW_PERMISSION_PROPS = new Set(['EditAll', 'ViewAll', 'ViewBasic']);

export const rules = {
  'no-raw-permission-access': {
    meta: {
      type: 'suggestion',
      docs: {
        description:
          'Components must consume named flags from useEntityPermissions ' +
          '(canEditTags, hasViewAccess, can(Operation.X)) instead of reading ' +
          'raw permission booleans. See #6036.',
      },
      messages: {
        rawPermissionAccess:
          'Raw permission access "{{name}}" — use useEntityPermissions ' +
          'flags or can(Operation.{{name}}) instead.',
      },
      schema: [],
    },
    create(context) {
      return {
        MemberExpression(node) {
          const name = node.property?.name;
          if (!RAW_PERMISSION_PROPS.has(name)) {
            return;
          }
          // Operation.EditAll (enum access) is the sanctioned spelling.
          if (node.object?.type === 'Identifier' && node.object.name === 'Operation') {
            return;
          }
          context.report({ node, messageId: 'rawPermissionAccess', data: { name } });
        },
      };
    },
  },
};

export default { rules };
