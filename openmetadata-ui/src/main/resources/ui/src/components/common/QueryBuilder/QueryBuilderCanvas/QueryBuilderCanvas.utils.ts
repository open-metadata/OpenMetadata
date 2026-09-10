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

/** A bracket the user drew: it owns a conjunction and holds rules. */
export const QUERY_BUILDER_GROUP_TYPE = 'group';

/** RAQB's own node types; a group holds children, a rule is a leaf. */
const QUERY_BUILDER_GROUP_TYPES = [QUERY_BUILDER_GROUP_TYPE, 'rule_group'];

/** The shape RAQB hands its own `renderField`, and so what OMFieldSelect reads. */
export interface QueryBuilderFieldNode {
  key: string;
  path: string;
  label: string;
  items?: QueryBuilderFieldNode[];
}

/**
 * `ConfigUtils` ships these helpers but does not declare them, so the shape is
 * asserted once here rather than cast at every call.
 */
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
    /** Subfield RAQB selects on the user's behalf when this field is picked. */
    defaultField?: string;
  } | null;
};

type RawFields = Record<string, Record<string, unknown>> | undefined;

/**
 * `config.fields` as the field tree RAQB's own renderers expect.
 *
 * Only a `!struct` groups its subfields in the picker. Every other field —
 * including a `!group` such as Owners, Tags or Glossary Term — is selectable
 * in its own right even though it carries subfields, which is exactly what
 * `Field.buildOptions` does. Treating any field with subfields as a parent
 * hides it: `OMFieldSelect` keeps only the leaves, so those fields vanish from
 * the picker and no rule can be built on them.
 */
export const toFieldNodes = (
  fields: unknown,
  prefix = ''
): QueryBuilderFieldNode[] =>
  Object.entries((fields ?? {}) as NonNullable<RawFields>).flatMap(
    ([key, def]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      const label = String(def?.label ?? key);
      const subfields = def?.subfields as RawFields;

      if (def?.type === '!struct' && subfields) {
        const items = toFieldNodes(subfields, path);

        return items.length > 0 ? [{ items, key, label, path }] : [];
      }

      if (subfields && Object.keys(subfields).length === 0) {
        return [];
      }

      return [{ key, label, path }];
    }
  );


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

/**
 * Flattens a chain of drill levels into the single row it describes.
 *
 * Choosing a field that owns subfields makes RAQB wrap the rule in a
 * `rule_group` per level. The user is still naming one field, so the levels
 * belong side by side in one row — drawing a card per level reads as a group
 * appearing by itself, and folding them into one control hides the choice
 * already made. Returns nothing for a group holding several rules: that is a
 * card.
 */
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

  const cells: QueryBuilderFieldCell[] = [];
  let current = node;
  let currentPath = path;
  let available = fields;
  let levelPrefix = prefix;
  // Whether this level is the user's to pick, or one RAQB fills in itself.
  let isChoice = true;

  while (current.type === 'rule_group' && current.children1?.length === 1) {
    if (isChoice) {
      cells.push({
        field: current.properties?.field ?? null,
        fields: available,
        path: currentPath,
        prefix: levelPrefix,
      });
    }

    const field = current.properties?.field ?? undefined;
    const drill = getGroupDrillFields(config, field);
    isChoice = Boolean(drill);
    available = drill;
    levelPrefix = field ?? '';

    const [only] = current.children1;
    currentPath = [...currentPath, String(only.id ?? 0)];
    current = only;
  }

  // Several rules share this level, so it is a group with a header of its own.
  if (QUERY_BUILDER_GROUP_TYPES.includes(current.type ?? '')) {
    return undefined;
  }

  if (isChoice) {
    cells.push({
      field: current.properties?.field ?? null,
      fields: available,
      path: currentPath,
      prefix: levelPrefix,
    });
  }

  return { cells, path: currentPath, rule: current };
};

/** Rules at any depth. Root children would count a seeded wrapper as one. */
export const countRules = (node?: QueryBuilderNode): number => {
  if (!node) {
    return 0;
  }

  return node.children1
    ? node.children1.reduce((total, child) => total + countRules(child), 0)
    : 1;
};

/**
 * Nested cards alternate between the two surfaces. Painting a card the colour
 * of the card it sits in would flatten the nesting the user needs to read, so
 * the screen picks the outermost ground and each level inverts it.
 */
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

/**
 * Every rule's position in render order, keyed by id.
 *
 * A spec that wants "the second condition" would otherwise reach for
 * `.nth(1)`, which the Playwright guardrails ban because it silently retargets
 * when the page changes. Indexing the rows here lets the spec name the one it
 * means.
 */
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
