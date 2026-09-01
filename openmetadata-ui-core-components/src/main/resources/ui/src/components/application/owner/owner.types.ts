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
import type { ReactNode } from 'react';
import type { AvatarSize, OwnerRef } from '../../../types';

/** Callback that wraps a rendered avatar chip for a single owner. */
export type RenderOwnerContent = (owner: OwnerRef, chip: ReactNode) => ReactNode;

export interface OwnerChipProps {
  owner: OwnerRef;
  avatarSize?: AvatarSize;
  isCompactView?: boolean;
  ownerDisplayName?: Map<string, ReactNode>;
  className?: string;
}

export interface OwnerAvatarStackProps {
  owners: OwnerRef[];
  avatarSize?: AvatarSize;
  maxVisibleOwners?: number;
  ownerDisplayName?: Map<string, ReactNode>;
  placement?: 'vertical' | 'horizontal';
  className?: string;
}

export interface OwnerProps {
  owners?: OwnerRef[];
  /** When true, renders owners as a horizontal row of chips (default). When false, renders a column with a header label row and avatar stack. */
  isCompactView?: boolean;
  maxVisibleOwners?: number;
  avatarSize?: AvatarSize;
  /** Show the "Owners" section label in non-compact view. */
  showLabel?: boolean;
  /** Render a dash (—) instead of nothing when owners is empty. */
  showDashPlaceholder?: boolean;
  /** Label text for the owners section; defaults to no label. */
  placeHolder?: string;
  placement?: 'vertical' | 'horizontal';
  /** Override display names keyed by owner id. */
  ownerDisplayName?: Map<string, ReactNode>;
  className?: string;
  ownerLabelClassName?: string;
  /** When true and hasPermission is true, shows an edit button for assignee flow. */
  isAssignee?: boolean;
  hasPermission?: boolean;
  /**
   * Pre-configured selector element (e.g. UserTeamSelectableList from the main UI).
   * Rendered as the edit/add trigger when hasPermission is true.
   */
  selectorContent?: ReactNode;
  /** Called when the assignee edit button is clicked (isAssignee mode only). */
  onEditClick?: () => void;
  'data-testid'?: string;
}
