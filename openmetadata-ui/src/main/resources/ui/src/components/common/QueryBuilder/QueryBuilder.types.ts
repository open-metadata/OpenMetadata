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
  JsonTree,
} from '@react-awesome-query-builder/ui';
import type { EntityType } from '../../../enums/entity.enum';
import type { QueryFilterInterface } from '../../../interface/queryFilter.interface';
import type { QueryBuilderConfigOverrides } from '../../../utils/queryBuilder/config';
import type {
  ConjunctionMode,
  GroupMode,
} from '../../../utils/queryBuilder/types';
import type { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';

/**
 * Everything a change produced, beyond the serialised value the caller
 * persists. Reported, never acted on: writing the Explore URL stays with
 * `AdvanceSearchProvider`.
 */
export interface QueryBuilderChangeMeta {
  queryFilter?: QueryFilterInterface;
  exploreUrl?: string;
  outputType: SearchOutputType;
}

export interface QueryBuilderProps {
  // ---- value ----
  /** Serialised ES filter or JSONLogic, as the caller persists it. */
  value?: string;
  /** A saved RAQB tree. Wins over `value`, and is what keeps saved filters loading. */
  tree?: JsonTree;
  /** Caller-controlled allow-list; falls back to the entity type's fields. */
  fields?: Config['fields'];

  // ---- shape ----
  outputType?: SearchOutputType;
  /** Plain user-created brackets only; `rule_group` is unaffected. */
  groupMode?: GroupMode;
  conjunctionMode?: ConjunctionMode;
  entityType?: EntityType;
  /** Seed field for an empty tree. */
  defaultField?: string;
  /** Seed subfield, for the JSONLogic `rule_group` seed. */
  subField?: string;
  readonly?: boolean;

  // ---- chrome ----
  label?: string;
  showCountPreview?: boolean;
  /** Turns the count banner into a link to Explore. */
  showExploreLink?: boolean;

  // ---- escape hatch ----
  /** Merged last, after every mode flag. */
  configOverrides?: QueryBuilderConfigOverrides;

  // ---- out ----
  onChange?: (
    value: string,
    tree?: JsonTree,
    meta?: QueryBuilderChangeMeta
  ) => void;
  /** Hands out RAQB's actions so a caller can drive Add-condition from its own chrome. */
  onActionsReady?: (actions: Actions) => void;
  /** False while a rule is incomplete. Callers gate save on this. */
  onValidityChange?: (isValid: boolean) => void;
}
