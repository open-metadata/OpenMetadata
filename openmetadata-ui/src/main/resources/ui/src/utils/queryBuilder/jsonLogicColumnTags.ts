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

// The Column Tags group is keyed `columns.tags`, but JsonLogic cannot follow a dotted var through the `columns` list,
// so it is saved as `some(columns, some(tags, cond))` and folded back to `some(columns.tags, cond)` on load.

const COLUMN_TAGS_VAR = 'columns.tags';

const isObject = (node: unknown): node is Record<string, unknown> =>
  typeof node === 'object' && node !== null && !Array.isArray(node);

const isVar = (node: unknown, name: string): boolean =>
  isObject(node) && Object.keys(node).length === 1 && node.var === name;

const someArgs = (node: unknown): unknown[] | undefined => {
  const args =
    isObject(node) && Object.keys(node).length === 1 ? node.some : undefined;

  return Array.isArray(args) && args.length === 2 ? args : undefined;
};

const mapTree = (
  node: unknown,
  visit: (child: unknown) => unknown
): unknown => {
  if (Array.isArray(node)) {
    return node.map(visit);
  }

  return isObject(node)
    ? Object.fromEntries(
        Object.entries(node).map(([key, value]) => [key, visit(value)])
      )
    : node;
};

export const expandColumnTagsVar = (node: unknown): unknown => {
  const args = someArgs(node);

  return args && isVar(args[0], COLUMN_TAGS_VAR)
    ? {
        some: [
          { var: 'columns' },
          { some: [{ var: 'tags' }, expandColumnTagsVar(args[1])] },
        ],
      }
    : mapTree(node, expandColumnTagsVar);
};

export const collapseColumnTagsVar = (node: unknown): unknown => {
  const outer = someArgs(node);
  const inner = outer && isVar(outer[0], 'columns') && someArgs(outer[1]);

  return inner && isVar(inner[0], 'tags')
    ? { some: [{ var: COLUMN_TAGS_VAR }, collapseColumnTagsVar(inner[1])] }
    : mapTree(node, collapseColumnTagsVar);
};
