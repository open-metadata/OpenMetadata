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

import { FC, ReactNode } from 'react';
import { TeamType } from '../../../../../../generated/entity/teams/team';
import { CSVImportResult } from '../../../../../../generated/type/csvImportResult';
import type { ProfileHashTarget } from './profileHash.utils';

export type MembersImportType = 'teams' | 'users';

// Minimal recursive shape of the /teams/hierarchy response used to build the
// create-user team multi-select.
export type TeamNode = {
  id: string;
  name: string;
  displayName?: string;
  children?: TeamNode[];
};

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

// A partial header update: only the keys present are applied, so a panel can own
// just the slots it sets (e.g. actions) without clobbering the title slots.
export interface MembersHeaderPatch {
  actions?: React.ReactNode;
  titleInput?: React.ReactNode;
  titleSuffix?: React.ReactNode;
}

export interface MembersUsersPanelProps extends MembersSubPanelProps {
  isAdmin?: boolean;
  onSetHeader?: (patch: MembersHeaderPatch) => void;
}

export interface MembersTeamDetailProps extends MembersSubPanelProps {
  fqn: string;
  onRename?: (newName: string) => void;
  onSetHeader?: (patch: MembersHeaderPatch) => void;
}

export interface OnlineStatusInfo {
  label: string;
  colorClass: string;
}

export type ProcessingType = 'preview' | 'import';

export type StageState = 'done' | 'active' | 'pending';

export interface SelectedCsvFile {
  content: string;
  name: string;
  rowCount: number;
  sizeLabel: string;
}

export interface ActiveJob {
  jobId?: string;
  status?: string;
}

export interface MembersImportFormProps {
  fqn: string;
  importType: MembersImportType;
  onClose: () => void;
}

export interface ImportRow {
  id: string;
  cells: Record<string, string>;
}

export interface ParsedImportResult {
  headers: string[];
  rows: ImportRow[];
}

export interface MembersImportResultTableProps {
  csvImportResult: CSVImportResult;
}

export interface MembersAddTeamFormProps {
  parentTeamType?: TeamType;
  parentTeamFqn?: string;
  onCancel: () => void;
  onSave: () => void;
}

export interface MembersCreateUserFormProps {
  isAdmin?: boolean;
  onNavigate: (view: MembersView) => void;
}

export interface ProfileHashLinkProps {
  target: ProfileHashTarget;
  /** Writes the hash synchronously (setHash); a plain react-router push is not
   * mirrored into useSettingsHash, so href-only navigation would not switch the
   * in-modal view. The href is kept for middle-click / open-in-new-tab. */
  onNavigate: (target: ProfileHashTarget) => void;
  children: ReactNode;
}

export interface TimeWindowOption {
  value: number;
  labelKey: string;
  labelParams?: Record<string, string | number>;
}
