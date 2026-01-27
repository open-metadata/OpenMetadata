/*
 *  Copyright 2023 Collate.
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
import { EntityTabs } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';

export interface DomainDetailsProps {
  domain: Domain;
  onUpdate: (value: Domain) => Promise<void>;
  onDelete: (id: string) => void;
  isVersionsView?: boolean;
  isFollowing?: boolean;
  isFollowingLoading?: boolean;
  handleFollowingClick?: () => void;
  /**
   * Optional override for the active tab when embedding DomainDetails outside of routed pages.
   */
  activeTab?: EntityTabs;
  /**
   * Handler invoked when active tab changes in embedded scenarios.
   */
  onActiveTabChange?: (tab: EntityTabs) => void;
  /**
   * Optional override for the domain FQN when routing context is not available.
   */
  domainFqnOverride?: string;
  /**
   * Optional navigation handler to intercept internal navigations triggered by the component.
   */
  onNavigate?: (path: string) => void;
  refreshDomains?: () => void;
  isTreeView?: boolean;
}
