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
import type {
  Actions,
  Config,
  FieldProps,
} from '@react-awesome-query-builder/ui';
import type { ReactNode } from 'react';
import type { QueryBuilderSurface } from '../../../../utils/queryBuilder/types';
import type { QueryBuilderButtonPreset } from '../QueryBuilderButton/QueryBuilderButton.types';

/** One node of the tree as `QbUtils.getTree` hands it back. */
export interface QueryBuilderNode {
  id?: string;
  type?: string;
  properties?: {
    conjunction?: string;
    field?: string | null;
    operator?: string | null;
    value?: unknown[];
    valueType?: string[];
  };
  children1?: QueryBuilderNode[];
}

/**
 * What every node in the canvas needs, and what none of them own. RAQB stays
 * the engine — it holds the tree and applies the mutations; the canvas is only
 * the surface the user sees.
 */
export interface QueryBuilderCanvasContext {
  actions: Actions;
  config: Config;
  /** Which ground the cards sit on, set by the screen embedding the builder. */
  surface: QueryBuilderSurface;
  /** Flat callers never nest, so they get no "add group" affordance. */
  allowGroups: boolean;
  /** Carries the testids Playwright locates this caller's controls by. */
  preset: QueryBuilderButtonPreset;
  readonly: boolean;
  /** False for a caller whose rules only ever combine one way. */
  showConjunction: boolean;
  /** Each rule's position in render order, so a row can name itself. */
  ruleIndexById: Record<string, number>;
  /**
   * A builder emptied to nothing leaves the user no way back, so the last
   * remaining condition keeps no delete control.
   */
  canRemoveRule: boolean;
}

export interface QueryBuilderRuleRowProps {
  rule: QueryBuilderNode;
  /** Path RAQB addresses this rule by, ancestors first. */
  path: string[];
  context: QueryBuilderCanvasContext;
  /**
   * Set when this row belongs to a `rule_group`, which owns the field its
   * children filter subfields of. The row then edits that field rather than
   * its own, so the card shows one Field control instead of two.
   */
  groupField?: { path: string[]; field: string };
}

export interface QueryBuilderControlProps {
  label: string;
  /** RAQB's field-tree shape, which the registered renderer reads. */
  items: unknown;
  selectedKey?: string | null;
  placeholder: string;
  readonly: boolean;
  /** `config.settings.renderField` or `renderOperator`. */
  render?: (props: FieldProps) => ReactNode;
  /** Overrides the testid the registered renderer would use by default. */
  dataTestId?: string;
  onChange: (key: string) => void;
}

export interface QueryBuilderAddGroupProps {
  /** The conjunctions the config allows; one means nothing to choose. */
  conjunctions: string[];
  testId: string;
  onAdd: (conjunction?: string) => void;
}

export interface QueryBuilderGroupConnectorProps {
  conjunction: string;
  /** The conjunctions the config allows; a single one locks the control. */
  conjunctions: string[];
  readonly: boolean;
  onChange: (conjunction: string) => void;
}

export interface QueryBuilderGroupHeaderProps {
  conjunction: string;
  path: string[];
  context: QueryBuilderCanvasContext;
  canRemove: boolean;
}

export interface QueryBuilderGroupCardProps {
  group: QueryBuilderNode;
  path: string[];
  context: QueryBuilderCanvasContext;
  /** The outermost card has nothing to be removed from. */
  canRemove: boolean;
  /** Nesting level, counted from the outermost visible card. */
  depth: number;
}

export type QueryBuilderCanvasProps = Omit<
  QueryBuilderCanvasContext,
  'canRemoveRule' | 'ruleIndexById'
> & {
  tree: unknown;
};
