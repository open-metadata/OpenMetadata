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
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';

export interface DomainFieldProps {
  /** Currently-assigned domain(s) for the entity. */
  domains?: EntityReference[];
  entityType: EntityType;
  entityFqn: string;
  entityId: string;
  /** Show the edit affordance (and allow assigning/removing). */
  hasPermission?: boolean;
  /** Allow assigning more than one domain. @default false */
  multiple?: boolean;
  /** Render a "Domains" heading row above the chips. @default false */
  showDomainHeading?: boolean;
  /** Chips shown before collapsing behind "+N More". */
  maxVisible?: number;
  /** Called after the default save with the updated entity. */
  afterDomainUpdateAction?: (asset: DataAssetWithDomains) => void;
  /**
   * Override the default JSON-patch save. Receives the new selection (single
   * reference or array; `undefined` when cleared in single mode).
   */
  onUpdate?: (
    domain: EntityReference | EntityReference[] | undefined
  ) => Promise<void> | void;
  /**
   * Inline "create domain" action forwarded to the picker. Wire this to a
   * create drawer (e.g. `useDomainCreateDrawer`) at the call site; kept out of
   * this component so consumers that do not need create stay lean.
   */
  onCreate?: (searchTerm: string) => void;
  createLabel?: string;
  'data-testid'?: string;
}
