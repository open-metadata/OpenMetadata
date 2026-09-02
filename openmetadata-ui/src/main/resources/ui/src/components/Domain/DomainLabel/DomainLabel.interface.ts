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

import { DataAssetWithDomains } from '../../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { EntityType } from '../../../enums/entity.enum';
import { User } from '../../../generated/entity/teams/user';
import { EntityReference } from '../../../generated/entity/type';

export interface NewDomainLabelProps {
  domains: EntityReference[] | undefined;

  /** Display-only or editable. Default: 'display'. */
  mode?: 'display' | 'selector';

  entityType: EntityType;
  entityFqn: string;
  entityId: string;

  /** Whether the current user can edit. */
  hasPermission?: boolean;

  /** Allow selecting multiple domains. Default: false. */
  multiple?: boolean;

  /**
   * Custom update handler. When provided, called instead of the built-in
   * JSON-patch update so parents can control the save flow.
   */
  onUpdate?: (domain: EntityReference | EntityReference[]) => Promise<void>;

  /**
   * Called after a successful built-in update so parent can refresh its state.
   */
  afterDomainUpdateAction?: (asset: DataAssetWithDomains) => void;

  /** Show "—" when no domain is assigned. Default: false (shows 'No domain'). */
  showDashPlaceholder?: boolean;

  /** Allow clearing the domain selection. Default: false. */
  isClearable?: boolean;

  /** Max visible domain chips before "+ N more". Default: 5. */
  sizeCap?: number;

  /** User data (for user-profile domain assignment context). */
  userData?: User;

  className?: string;
}
