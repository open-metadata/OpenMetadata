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
import type { QueryBuilderNode } from './QueryBuilderCanvas.types';

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
  ) => { fieldSettings?: Record<string, unknown> } | null;
};

type RawFields = Record<string, Record<string, unknown>> | undefined;

/**
 * `config.fields` as the field tree RAQB's renderers expect. Kept a tree
 * rather than flattened here: `OMFieldSelect` does its own leaf-walking, and
 * handing it the same shape RAQB does keeps the two paths identical.
 */
export const toFieldNodes = (
  fields: unknown,
  prefix = ''
): QueryBuilderFieldNode[] =>
  Object.entries((fields ?? {}) as NonNullable<RawFields>).map(([key, def]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const label = String(def?.label ?? key);
    const subfields = def?.subfields as RawFields;

    return subfields
      ? { key, label, path, items: toFieldNodes(subfields, path) }
      : { key, label, path };
  });

/**
 * What a `rule_group` can group on: the top level of the config, whether or
 * not an entry owns subfields.
 *
 * Not "parents only" — a semantic rule is just as often built on a plain field
 * like Description as on one with subfields like Owners, and RAQB switches the
 * node between `rule_group` and `rule` accordingly. Subfields are not offered
 * here either; they belong to the rules inside the group.
 */
export const toGroupFieldNodes = (fields: unknown): QueryBuilderFieldNode[] =>
  Object.entries((fields ?? {}) as NonNullable<RawFields>).map(
    ([key, def]) => ({
      key,
      label: String(def?.label ?? key),
      path: key,
    })
  );

/** Rules at any depth. Root children would count a seeded wrapper as one. */
export const countRules = (node?: QueryBuilderNode): number => {
  if (!node) {
    return 0;
  }

  return node.children1
    ? node.children1.reduce((total, child) => total + countRules(child), 0)
    : 1;
};

/** RAQB's own node types; a group holds children, a rule is a leaf. */
export const QUERY_BUILDER_GROUP_TYPES = ['group', 'rule_group'];

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
