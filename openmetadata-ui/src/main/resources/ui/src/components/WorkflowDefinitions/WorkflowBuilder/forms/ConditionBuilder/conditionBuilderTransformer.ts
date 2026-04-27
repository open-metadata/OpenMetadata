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

import type {
  CheckChangeDescConditionPayload,
  ConditionBuilderPayload,
  ConditionRow,
  ConditionRulesMap,
  ConditionType,
} from './ConditionBuilder.interface';

export function generateRowId(index?: number): string {
  const suffix = Math.random().toString(36).slice(2, 9);

  return typeof index === 'number'
    ? `row-${index}-${Date.now()}-${suffix}`
    : `row-${Date.now()}-${suffix}`;
}

const DELETED_FIELD = 'deleted';

/**
 * Convert rows (field + values per row) into rules object for payload.
 * For "deleted" field, sends boolean true/false; others send string[].
 */
export function rowsToRules(rows: ConditionRow[]): ConditionRulesMap {
  const rules: ConditionRulesMap = {};
  for (const row of rows) {
    if (!row.field || !Array.isArray(row.values)) {
      continue;
    }
    if (row.field === DELETED_FIELD) {
      const v = row.values[0];
      if (v === 'true' || v === 'false') {
        rules[row.field] = v === 'true';
      }

      continue;
    }
    const trimmed = row.values
      .filter((v) => v != null && String(v).trim() !== '')
      .map((v) => String(v).trim());
    if (trimmed.length > 0) {
      rules[row.field] = trimmed;
    }
  }

  return rules;
}

/**
 * Convert rules object into rows for editing. Handles string[] and boolean (e.g. "deleted").
 */
export function rulesToRows(
  rules: ConditionRulesMap | null | undefined
): ConditionRow[] {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    return [];
  }
  const rows: ConditionRow[] = [];
  let index = 0;
  for (const [field, value] of Object.entries(rules)) {
    if (field === DELETED_FIELD && typeof value === 'boolean') {
      rows.push({
        id: generateRowId(index++),
        field,
        values: [value ? 'true' : 'false'],
      });

      continue;
    }
    if (Array.isArray(value)) {
      const trimmed = value
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => String(v).trim());
      if (trimmed.length > 0) {
        rows.push({
          id: generateRowId(index++),
          field,
          values: trimmed,
        });
      }
    }
  }

  return rows;
}

/**
 * Parse payload into rows and condition. Supports config.rules (object) and config.include (legacy).
 */
export function parseConditionBuilderPayload(
  payload: ConditionBuilderPayload | null | undefined
): { rows: ConditionRow[]; condition: ConditionType } {
  if (!payload?.config) {
    return { rows: [], condition: 'OR' };
  }
  const { config } = payload;
  const condition = config.condition ?? 'OR';
  const rules = config.rules;
  const legacyInclude = (config as { include?: ConditionRulesMap }).include;

  let rulesObj: ConditionRulesMap | null = null;
  if (
    rules &&
    typeof rules === 'object' &&
    !Array.isArray(rules) &&
    Object.keys(rules).length > 0
  ) {
    rulesObj = rules;
  } else if (
    legacyInclude &&
    typeof legacyInclude === 'object' &&
    !Array.isArray(legacyInclude)
  ) {
    rulesObj = legacyInclude;
  }

  const rows = rulesObj ? rulesToRows(rulesObj) : [];

  return { rows, condition };
}

/**
 * Build CheckChangeDesc payload: { config: { condition, rules } } with rules as Record<string, string[]>.
 */
export function buildConditionBuilderPayload(
  condition: ConditionType,
  rows: ConditionRow[]
): CheckChangeDescConditionPayload {
  return {
    config: {
      condition,
      rules: rowsToRules(rows),
    },
  };
}
