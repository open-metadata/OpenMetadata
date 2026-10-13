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
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import {
  QUERY_BUILDER_SURFACE,
  type QueryBuilderSurface,
} from '../../../../utils/queryBuilder/types';
import type {
  QueryBuilderFieldCell,
  QueryBuilderNode,
  QueryBuilderRuleRowModel,
} from './QueryBuilderCanvas.types';

// A bracket the user drew: it owns a conjunction and holds rules.
export const QUERY_BUILDER_GROUP_TYPE = 'group';

// RAQB's own node types; a group holds children, a rule is a leaf.
const QUERY_BUILDER_GROUP_TYPES = [QUERY_BUILDER_GROUP_TYPE, 'rule_group'];

// The shape RAQB hands its own `renderField`, and so what OMFieldSelect reads.
interface QueryBuilderFieldNode {
  key: string;
  path: string;
  label: string;
  items?: QueryBuilderFieldNode[];
}

// `ConfigUtils` ships these helpers but does not declare them, so the shape is asserted once here rather than cast at
// every call.
export const configUtils = QbUtils.ConfigUtils as unknown as {
  getOperatorsForField: (config: unknown, field: string) => string[] | null;
  getWidgetForFieldOp: (
    config: unknown,
    field: string,
    operator: string,
    valueSrc: string
  ) => string | undefined;
  getFieldConfig: (
    config: unknown,
    field: string
  ) => {
    type?: string;
    fieldSettings?: Record<string, unknown>;
    subfields?: Record<string, unknown>;
    // Subfield RAQB selects on the user's behalf when this field is picked.
    defaultField?: string;
  } | null;
};

type RawFields = Record<string, Record<string, unknown>> | undefined;

// `config.fields` as a flat pick list; `OMFieldSelect` renders only leaves.
export const toFieldNodes = (
  fields: unknown,
  prefix = ''
): QueryBuilderFieldNode[] =>
  Object.entries((fields ?? {}) as NonNullable<RawFields>).flatMap(
    ([key, def]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      const label = String(def?.label ?? key);
      const subfields = def?.subfields as RawFields;

      if (subfields && Object.keys(subfields).length === 0) {
        return [];
      }

      return [{ key, label, path }];
    }
  );

// The `!struct` a dotted field sits under, with the subfields below it.
export const getStructLevel = (
  config: unknown,
  field: string | undefined
): { field: string; subfields: Record<string, unknown> } | undefined => {
  const parts = (field ?? '').split('.');

  for (let depth = 1; depth < parts.length; depth++) {
    const prefix = parts.slice(0, depth).join('.');
    const fieldConfig = configUtils.getFieldConfig(config, prefix);

    if (fieldConfig?.type === '!struct' && fieldConfig.subfields) {
      return { field: prefix, subfields: fieldConfig.subfields };
    }
  }

  return undefined;
};

// A struct is a level, not a field, so a choice of one lands inside it.
export const resolveSelectedField = (config: unknown, key: string): string => {
  const fieldConfig = configUtils.getFieldConfig(config, key);

  if (fieldConfig?.type !== '!struct') {
    return key;
  }

  const [first] = Object.keys(fieldConfig.subfields ?? {});

  return first ? `${key}.${first}` : key;
};

export const getGroupDrillFields = (
  config: unknown,
  field: string | undefined
): Record<string, unknown> | undefined => {
  if (!field) {
    return undefined;
  }

  const fieldConfig = configUtils.getFieldConfig(config, field);
  const subfields = fieldConfig?.subfields;

  if (!subfields || Object.keys(subfields).length === 0) {
    return undefined;
  }

  return fieldConfig?.defaultField ? undefined : subfields;
};

// The field a node filters on, if it has one.
const fieldOf = (node: QueryBuilderNode): string | undefined =>
  node.properties?.field ?? undefined;

// Whether a node is a level rather than a leaf rule.
const isGroupNode = (node: QueryBuilderNode): boolean =>
  QUERY_BUILDER_GROUP_TYPES.includes(node.type ?? '');

// A level RAQB wrapped around one rule while the user drills into a field.
const isDrillWrapper = (node: QueryBuilderNode): boolean =>
  node.type === 'rule_group' && node.children1?.length === 1;

// RAQB wraps a `!group` in a node but not a `!struct`, so a struct's level needs a cell of its own.
const withStructLevel = (
  config: unknown,
  cell: QueryBuilderFieldCell,
  isUndrilled: boolean
): QueryBuilderFieldCell[] => {
  const structLevel = isUndrilled
    ? getStructLevel(config, cell.field ?? undefined)
    : undefined;

  if (!structLevel) {
    return [cell];
  }

  // Both cells edit the same rule, so both address the same path.
  return [
    { ...cell, field: structLevel.field },
    { ...cell, fields: structLevel.subfields, prefix: structLevel.field },
  ];
};

// The controls the leaf rule itself contributes.
const getLeafCells = ({
  available,
  config,
  isChoice,
  isUndrilled,
  path,
  prefix,
  rule,
}: {
  available?: Record<string, unknown>;
  config: unknown;
  isChoice: boolean;
  isUndrilled: boolean;
  path: string[];
  prefix: string;
  rule: QueryBuilderNode;
}): QueryBuilderFieldCell[] =>
  isChoice
    ? withStructLevel(
        config,
        { field: fieldOf(rule) ?? null, fields: available, path, prefix },
        isUndrilled
      )
    : [];

interface DrillWalk {
  cells: QueryBuilderFieldCell[];
  current: QueryBuilderNode;
  path: string[];
  available?: Record<string, unknown>;
  prefix: string;
  // Whether the next level is the user's to pick, or one RAQB fills in.
  isChoice: boolean;
}

// Walks RAQB's drill wrappers, collecting a cell per level the user chose.
const consumeDrillLevels = (
  config: unknown,
  node: QueryBuilderNode,
  path: string[],
  fields?: Record<string, unknown>,
  prefix = ''
): DrillWalk => {
  const walk: DrillWalk = {
    available: fields,
    cells: [],
    current: node,
    isChoice: true,
    path,
    prefix,
  };

  while (isDrillWrapper(walk.current)) {
    if (walk.isChoice) {
      walk.cells.push(
        ...withStructLevel(
          config,
          {
            field: fieldOf(walk.current) ?? null,
            fields: walk.available,
            path: walk.path,
            prefix: walk.prefix,
          },
          walk.cells.length === 0
        )
      );
    }

    const field = fieldOf(walk.current);
    const drill = getGroupDrillFields(config, field);
    const [only = {}] = walk.current.children1 ?? [];

    walk.isChoice = Boolean(drill);
    walk.available = drill;
    walk.prefix = field ?? '';
    walk.path = [...walk.path, String(only.id ?? 0)];
    walk.current = only;
  }

  return walk;
};

// Flattens a chain of drill levels into the single row it describes.
export const getRuleRowModel = (
  config: unknown,
  node: QueryBuilderNode,
  path: string[],
  fields?: Record<string, unknown>,
  prefix = ''
): QueryBuilderRuleRowModel | undefined => {
  if (node.type === 'group') {
    return undefined;
  }

  const walk = consumeDrillLevels(config, node, path, fields, prefix);

  // Several rules share this level, so it is a group with a header of its own.
  if (isGroupNode(walk.current)) {
    return undefined;
  }

  walk.cells.push(
    ...getLeafCells({
      available: walk.available,
      config,
      isChoice: walk.isChoice,
      // A rule reached through drill wrappers has already named its levels.
      isUndrilled: walk.cells.length === 0,
      path: walk.path,
      prefix: walk.prefix,
      rule: walk.current,
    })
  );

  return { cells: walk.cells, path: walk.path, rule: walk.current };
};

// Rules at any depth.
export const countRules = (node?: QueryBuilderNode): number => {
  if (!node) {
    return 0;
  }

  return node.children1
    ? node.children1.reduce((total, child) => total + countRules(child), 0)
    : 1;
};

// Nested cards alternate between the two surfaces.
export const getSurfaceForDepth = (
  base: QueryBuilderSurface,
  depth: number
): QueryBuilderSurface => {
  if (depth % 2 === 0) {
    return base;
  }

  return base === QUERY_BUILDER_SURFACE.PLAIN
    ? QUERY_BUILDER_SURFACE.SUBTLE
    : QUERY_BUILDER_SURFACE.PLAIN;
};

// Every rule's position in render order, keyed by id.
export const buildRuleIndex = (
  node?: QueryBuilderNode,
  acc: Record<string, number> = {},
  counter: { next: number } = { next: 0 }
): Record<string, number> => {
  if (!node) {
    return acc;
  }

  if (!node.children1) {
    if (node.id) {
      acc[node.id] = counter.next;
      counter.next += 1;
    }

    return acc;
  }

  node.children1.forEach((child) => buildRuleIndex(child, acc, counter));

  return acc;
};
