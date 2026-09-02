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
import type { ButtonProps } from '@react-awesome-query-builder/ui';

export type QueryBuilderButtonKind =
  | 'addRule'
  | 'delRule'
  | 'addGroup'
  | 'delGroup'
  | 'delRuleGroup';

/**
 * The per-caller differences between the four button renderers this component
 * replaced. They had drifted rather than been designed, so they are data now
 * instead of four implementations.
 */
export interface QueryBuilderButtonPreset {
  /**
   * Icon sizing for the row the builder sits in. The old renderers disagreed
   * here (`tw:size-4` vs `tw:size-3.5`), which is why the Elasticsearch and
   * JSONLogic builders looked subtly different.
   */
  iconClassName: string;
  /** Omit for an icon-only add button. */
  addRuleLabel?: () => string;
  /** Load-bearing in Playwright — see playwright/utils/advancedSearch.ts. */
  testIds: Record<QueryBuilderButtonKind, string>;
}

export interface QueryBuilderButtonProps {
  preset: QueryBuilderButtonPreset;
  buttonProps?: ButtonProps;
}
