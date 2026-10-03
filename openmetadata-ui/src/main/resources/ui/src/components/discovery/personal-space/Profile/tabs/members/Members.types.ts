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

import { FC } from 'react';

export type MembersImportType = 'teams' | 'users';

export type MembersView =
  | { type: 'landing' }
  | { type: 'teams' }
  | { type: 'team-detail'; fqn: string; name: string }
  | { type: 'teams-add'; parentFqn?: string }
  | { type: 'teams-import'; fqn: string; importType: MembersImportType }
  | { type: 'users' }
  | { type: 'admins' }
  | { type: 'user-create'; isAdmin?: boolean }
  | { type: 'online-users' };

export interface MembersLandingCard {
  id: string;
  icon: FC<{ className?: string }>;
  titleKey: string;
  descriptionKey: string;
  view: MembersView;
}

export interface MembersPanelProps {
  onHeaderChange?: (
    override: import('../../profileNavConfig').ProfileHeaderOverride | null
  ) => void;
}

export interface MembersSubPanelProps {
  onNavigate: (view: MembersView) => void;
}

export interface MembersUsersPanelProps extends MembersSubPanelProps {
  isAdmin?: boolean;
  onSetHeaderActions?: (actions: React.ReactNode) => void;
}

export interface MembersTeamDetailProps extends MembersSubPanelProps {
  fqn: string;
  onRename?: (newName: string) => void;
  onSetHeaderActions?: (actions: React.ReactNode) => void;
  onSetHeaderTitleInput?: (input: React.ReactNode) => void;
  onSetHeaderTitleSuffix?: (suffix: React.ReactNode) => void;
}

export interface OnlineStatusInfo {
  label: string;
  colorClass: string;
}

export interface TimeWindowOption {
  value: number;
  labelKey: string;
  labelParams?: Record<string, string | number>;
}
