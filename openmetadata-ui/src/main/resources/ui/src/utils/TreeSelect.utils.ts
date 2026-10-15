/*
 *  Copyright 2024 Collate.
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
import { TreeSelectNode } from '@openmetadata/ui-core-components';

export interface TreeOption {
  value: string | number;
  label?: string;
  title?: string;
  children?: TreeOption[];
  disabled?: boolean;
}

export const toTreeSelectNodes = (
  options: TreeOption[],
  parentId?: string
): TreeSelectNode[] =>
  options.map((option) => ({
    id: String(option.value),
    value: String(option.value),
    // Core uses string values; preserve numeric enums for the schema payload.
    data: option.value,
    label: option.label ?? option.title ?? String(option.value),
    parentId,
    disabled: option.disabled,
    children: option.children
      ? toTreeSelectNodes(option.children, String(option.value))
      : undefined,
  }));

export const getTreeSelectValue = (
  nodes: TreeSelectNode[],
  values: (string | number)[] = []
): TreeSelectNode[] => {
  const selected = new Set(values);
  const result: TreeSelectNode[] = [];
  const visit = (items: TreeSelectNode[], parentSelected = false) =>
    items.forEach((node) => {
      const isSelected =
        parentSelected ||
        selected.has(node.data as string | number) ||
        selected.has((node.data as string | number) ?? node.value ?? node.id);
      if (isSelected) {
        result.push(node);
      }
      if (node.children) {
        visit(node.children, isSelected);
      }
    });
  // Core tracks each checked descendant; expand persisted parent values so the
  // synthetic All row and its children agree when the picker first opens.
  visit(nodes);

  return result;
};

export const getTreeSelectValues = (
  selection: TreeSelectNode | TreeSelectNode[] | null
): (string | number)[] => {
  const nodes = selection ? [selection].flat() : [];
  const selectedIds = new Set(nodes.map((node) => node.id));

  return nodes
    .filter((node) => !node.parentId || !selectedIds.has(node.parentId))
    .map((node) => node.value ?? node.id);
};
