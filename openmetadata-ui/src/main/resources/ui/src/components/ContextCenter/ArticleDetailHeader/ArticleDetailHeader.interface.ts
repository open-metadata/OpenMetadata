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

import { VotingDataProps } from 'components/Entity/Voting/voting.interface';
import { OperationPermission } from 'context/PermissionProvider/PermissionProvider.interface';
import {
  ArticleTab,
  ContentChangeState,
  KnowledgePage,
} from 'interface/knowledge-center.interface';

export type { ArticleTab };

export interface ArticleDetailHeaderProps {
  knowledgePage?: KnowledgePage;
  contentChangeState: ContentChangeState;
  permissions: OperationPermission;
  tabs?: ArticleTab[];
  activeTab?: string;
  isRightPanelOpen: boolean;
  feedCount?: number;
  onTabChange?: (key: string) => void;
  onToggleRightPanel: () => void;
  onVoteChange: (type: VotingDataProps) => Promise<void>;
  onFollowChange: () => Promise<void>;
  onToggleDelete: () => void;
  onSave?: () => void;
  onSetThreadLink: (link: string) => void;
  fetchKnowledgePageHierarchy?: (forceRefresh?: boolean) => Promise<void>;
}
