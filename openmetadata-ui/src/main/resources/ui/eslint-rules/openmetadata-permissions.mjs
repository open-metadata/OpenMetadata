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
      type: 'problem',
      docs: {
        description:
          'Components must consume named flags from useEntityPermissions ' +
          '(canEditTags, hasViewAccess, can(Operation.X)) instead of reading ' +
          'raw permission booleans off an OperationPermission object — by ' +
          'member access (x.EditAll, x?.EditAll) or by destructuring ' +
          '(const { EditAll } = x). The Operation enum itself is exempt, ' +
          'including any local alias created by `import { Operation as Op }`. ' +
          'Known limitation: computed/bracket access (perms[Operation.EditAll]) ' +
          'is intentionally NOT flagged — it is the sanctioned dynamic-key ' +
          'pattern used by PermissionDerivation.ts and similar core utils, and ' +
          'it cannot be distinguished statically from arbitrary computed member ' +
          'access without false positives. See #6036.',
      },
      messages: {
        rawPermissionAccess:
          'Raw permission access "{{name}}" — use useEntityPermissions ' +
          'flags or can(Operation.{{name}}) instead.',
      },
      schema: [],
    },
    create(context) {
      // Local names bound to the `Operation` enum. Seeded with the literal
      // identifier `Operation` (the common case, and what fixture snippets
      // without an import in scope rely on); `import { Operation as Op }`
      // adds any local alias to the same set below.
      const operationLocalNames = new Set(['Operation']);

      const isOperationIdentifier = (node) =>
        node?.type === 'Identifier' && operationLocalNames.has(node.name);

      return {
        ImportSpecifier(node) {
          if (
            node.imported?.type === 'Identifier' &&
            node.imported.name === 'Operation'
          ) {
            operationLocalNames.add(node.local.name);
          }
        },
        MemberExpression(node) {
          // Computed/bracket access (perms[Operation.EditAll]) is a
          // documented limitation — see meta.docs.description. It cannot be
          // distinguished from arbitrary computed access without false
          // positives, and is the sanctioned dynamic-key pattern in
          // PermissionDerivation.ts and similar core utils.
          if (node.computed) {
            return;
          }
          const name = node.property?.name;
          if (!RAW_PERMISSION_PROPS.has(name)) {
            return;
          }
          // Operation.EditAll (enum access, including local import aliases)
          // is the sanctioned spelling.
          if (isOperationIdentifier(node.object)) {
            return;
          }
          context.report({ node, messageId: 'rawPermissionAccess', data: { name } });
        },
        ObjectPattern(node) {
          const parent = node.parent;
          const source =
            parent?.type === 'VariableDeclarator'
              ? parent.init
              : parent?.type === 'AssignmentExpression' && parent.left === node
              ? parent.right
              : null;

          // Destructuring directly off the Operation enum (rare) is exempt,
          // same as the MemberExpression case.
          if (isOperationIdentifier(source)) {
            return;
          }

          for (const prop of node.properties) {
            if (prop.type !== 'Property' || prop.computed) {
              continue;
            }
            const name = prop.key?.name;
            if (!RAW_PERMISSION_PROPS.has(name)) {
              continue;
            }
            context.report({
              node: prop,
              messageId: 'rawPermissionAccess',
              data: { name },
            });
          }
        },
      };
    },
  },
};

export default { rules };
