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
  Config,
  Conjunctions,
  RenderSettings,
} from '@react-awesome-query-builder/ui';
import { isArray } from 'lodash';
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { SearchIndex } from '../../enums/search.enum';
import advancedSearchClassBase from '../AdvancedSearchClassBase';
import jsonLogicSearchClassBase from '../JSONLogicSearchClassBase';
import { PERSISTENT_EMPTY_TREE_SETTINGS, READONLY_SETTINGS } from './tree';
import { EntityType } from '../../enums/entity.enum';
import type {
  ConjunctionMode,
  GroupMode,
  QueryBuilderConfigModes,
} from './types';
import {
  QUERY_BUILDER_CONJUNCTION_MODE,
  QUERY_BUILDER_GROUP_MODE,
} from './types';

/**
 * Button types that create or destroy a user-authored bracket. These are the
 * only affordances flat mode withholds — `delRule` and `delRuleGroup` are
 * untouched, because a `rule_group` is structural rather than user-authored.
 */
const GROUP_BUTTON_TYPES = new Set(['addGroup', 'delGroup']);

/**
 * A caller's escape hatch. `settings` is separately partial because RAQB's own
 * `Settings` type has required members, so a plain `Partial<Config>` would
 * force a caller overriding one flag to supply the whole block.
 */
export interface QueryBuilderConfigOverrides
  extends Partial<Omit<Config, 'settings'>> {
  settings?: Partial<Config['settings']>;
}

export interface BuildQueryBuilderConfigOptions
  extends QueryBuilderConfigModes {
  outputType: SearchOutputType;
  searchIndex: SearchIndex | SearchIndex[];
  /**
   * The entity type the builder is pinned to, if any.
   *
   * Custom-property field keys omit the entity-type segment when a builder is
   * pinned to one type, so the Elasticsearch formatter cannot recover it from
   * the field name. It reads this instead, to scope the nested
   * `customPropertiesTyped` query to the selected type.
   */
  entityType?: string;
  /** Defaults to `flat`: a caller that wants brackets has to ask for them. */
  groupMode?: GroupMode;
  conjunctionMode?: ConjunctionMode;
  readonly?: boolean;
  /** Caller-controlled allow-list; falls back to the class base's fields. */
  fields?: Config['fields'];
  /** Merged last, so a caller can always win. */
  configOverrides?: QueryBuilderConfigOverrides;
}

/**
 * Wraps a button renderer so flat mode cannot produce a bracket, whichever
 * renderer the caller supplied. Doing it here rather than in each renderer is
 * what makes `groupMode` a guarantee instead of a convention.
 */
const withGroupModeButtons = (
  renderButton: RenderSettings['renderButton'],
  groupMode: GroupMode
): RenderSettings['renderButton'] => {
  if (groupMode === QUERY_BUILDER_GROUP_MODE.NESTED) {
    return renderButton;
  }

  return ((props, ctx) =>
    GROUP_BUTTON_TYPES.has(props?.type)
      ? null
      : renderButton?.(props, ctx)) as RenderSettings['renderButton'];
};

/**
 * Restricts the AND/OR control to a single conjunction when the caller has
 * fixed it.
 *
 * RAQB hides the control on its own once only one conjunction is available —
 * `Group.showConjs()` requires `conjunctionCount > 1` — so narrowing the map
 * both fixes the value and removes the affordance, with no separate flag.
 */
const applyConjunctionMode = (
  conjunctions: Conjunctions | undefined,
  mode: ConjunctionMode
): Conjunctions => {
  if (mode === QUERY_BUILDER_CONJUNCTION_MODE.EDITABLE || !conjunctions) {
    return conjunctions as Conjunctions;
  }

  const key = mode.toUpperCase();

  return conjunctions[key]
    ? ({ [key]: conjunctions[key] } as Conjunctions)
    : conjunctions;
};

/**
 * The one place a query-builder `Config` is assembled.
 *
 * Order is deliberate: the class base (which is itself `OMConfig` plus
 * entity fields) provides the substrate, mode flags are layered on top, and
 * `configOverrides` lands last so an escape hatch always wins.
 */
export const buildQueryBuilderConfig = ({
  outputType,
  searchIndex,
  entityType,
  groupMode = QUERY_BUILDER_GROUP_MODE.FLAT,
  conjunctionMode = QUERY_BUILDER_CONJUNCTION_MODE.EDITABLE,
  readonly = false,
  fields,
  configOverrides,
  showLabels,
  useFriendlyOperatorLabels,
  renderButton,
}: BuildQueryBuilderConfigOptions): Config => {
  const indexes = isArray(searchIndex) ? searchIndex : [searchIndex];
  const modes: QueryBuilderConfigModes = {
    showLabels,
    useFriendlyOperatorLabels,
    renderButton,
  };

  const base = (
    outputType === SearchOutputType.ElasticSearch
      ? advancedSearchClassBase.getQbConfigs(indexes, modes)
      : jsonLogicSearchClassBase.getQbConfigs(indexes, modes)
  ) as Config;

  // A class base can hand back a partial config — tests stub `getQbConfigs`,
  // and a Collate override may not populate every slot — so nothing here may
  // assume a fully-formed base.
  const baseSettings = base?.settings ?? ({} as Config['settings']);

  return {
    ...base,
    ...configOverrides,
    conjunctions: applyConjunctionMode(
      configOverrides?.conjunctions ?? base?.conjunctions,
      conjunctionMode
    ),
    fields: configOverrides?.fields ?? fields ?? base?.fields,
    settings: {
      ...baseSettings,
      ...PERSISTENT_EMPTY_TREE_SETTINGS,
      // Read by the Elasticsearch formatter for custom-property fields whose
      // key carries no entity-type segment. RAQB's `Settings` type is closed,
      // so this rides along as an extra key — the library ignores what it does
      // not know, and the formatter reads it back off the same object.
      ...({
        omEntityType: entityType === EntityType.ALL ? undefined : entityType,
      } as Record<string, unknown>),
      canRegroup: groupMode === QUERY_BUILDER_GROUP_MODE.NESTED,
      renderButton: withGroupModeButtons(baseSettings.renderButton, groupMode),
      ...(readonly ? READONLY_SETTINGS : {}),
      ...configOverrides?.settings,
    },
  };
};
