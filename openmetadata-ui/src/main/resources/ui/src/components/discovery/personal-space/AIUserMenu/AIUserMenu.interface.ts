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

import React, { ReactNode } from 'react';

export interface UserPersonaLike {
  displayName?: string;
  id?: string;
  name?: string;
}

export interface CurrentUserExtras {
  defaultPersona?: UserPersonaLike;
  inheritedPersonas?: UserPersonaLike[];
  persona?: UserPersonaLike;
  personas?: UserPersonaLike[];
  profile?: { images?: { image?: string } };
  roles?: UserPersonaLike[];
}

/**
 * A menu entry. Three variants:
 *  - separator  — `type: 'separator'`
 *  - custom     — `type: 'item'`, `node` is set, renders the node as-is
 *  - action     — `type: 'item'`, no `node`; `children` presence triggers submenu
 */
export interface MenuItemConfig {
  type: 'item' | 'separator';
  id: string;
  /** Icon shown on the left. Required for action items, unused for separator/custom. */
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Icon width/height in px for a submenu child row. Defaults to 14. */
  iconSize?: number;
  /** Primary label text. */
  label?: string;
  /** Secondary text rendered below the label. */
  supportingText?: string;
  /** Custom React node — renders instead of the default icon+label row. */
  node?: ReactNode;
  /** Nested items — presence triggers submenu rendering. Same shape as parent. */
  children?: MenuItemConfig[];
  /** Called when this item (or a child item) is activated. */
  onAction?: (key?: string) => void;
  /** Whether the active indicator dot is shown (e.g. selected language). */
  isActive?: boolean;
  /** Optional test id forwarded to the rendered menu entry. */
  dataTestId?: string;
}

export interface AIUserMenuProps {
  collapsed?: boolean;
}
