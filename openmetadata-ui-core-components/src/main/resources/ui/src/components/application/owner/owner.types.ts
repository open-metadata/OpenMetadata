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
import type { AvatarSize, OwnerEntityReference } from '../../../types';
import type { OwnerDetails } from './owner-utils';

export type RenderOwnerContent = (
  owner: OwnerEntityReference,
  chip: ReactNode
) => ReactNode;

export interface OwnerChipProps {
  owner: OwnerEntityReference;
  avatarSize?: AvatarSize;
  isCompactView?: boolean;
  ownerDisplayName?: Map<string, ReactNode>;
  className?: string;
}

export interface OwnerAvatarStackProps {
  owners: OwnerEntityReference[];
  avatarSize?: AvatarSize;
  maxVisibleOwners?: number;
  ownerDisplayName?: Map<string, ReactNode>;
  placement?: 'vertical' | 'horizontal';
  className?: string;
  /** Show the "N Owners" title and per-group labels in the overflow popover
   * (default true). Set false for a bare list of avatars + names. */
  showOverflowHeadings?: boolean;
}

export interface OwnerProps {
  /**
   * Owner refs to display. Accepts raw refs (the app's EntityReference shape) —
   * `Owner` normalises them to `OwnerEntityReference` internally, so call sites pass the
   * array as-is with no `toOwnerRefs`/`toOwnersWithHref` wrapping.
   */
  owners?: OwnerDetails[];
  /**
   * When true, renders owners as a horizontal row of chips (default).
   * When false, renders a column with a header label row and avatar stack.
   */
  isCompactView?: boolean;
  maxVisibleOwners?: number;
  avatarSize?: AvatarSize;
  /** Show the "Owners" section label in non-compact view. */
  showLabel?: boolean;
  /** Render a dash (—) instead of nothing when owners is empty. */
  showDashPlaceholder?: boolean;
  /** Label text for the owners section; defaults to no label. */
  placeHolder?: string;
  /** Override display names keyed by owner id. */
  ownerDisplayName?: Map<string, ReactNode>;
  className?: string;
  hasPermission?: boolean;
  /**
   * Pre-configured selector element (e.g. UserTeamSelectableList from the main UI).
   * Rendered as the edit/add trigger when hasPermission is true.
   */
  selectorContent?: ReactNode;
  'data-testid'?: string;
}
