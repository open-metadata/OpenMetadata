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

import type { FC, ReactNode } from 'react';
import type { HeaderShellVariant } from '../HeaderShell/HeaderShell.interface';

export interface EntityDetailTab {
  /** Stable key used for selection and URL/routing. */
  key: string;
  /** Tab strip label. */
  label: ReactNode;
  /** Optional count badge shown next to the label. */
  count?: number;
  /** When true the tab is filtered out of the strip. */
  isHidden?: boolean;
  /** Panel content rendered by the header when renderPanels !== false. */
  panel?: ReactNode;
}

export type EntityDetailHeaderTabType =
  | 'underline'
  | 'button-brand'
  | 'button-gray'
  | 'button-border'
  | 'button-minimal';

export interface EntityDetailHeaderProps {
  /** Breadcrumb node (e.g. HeaderBreadcrumb or TitleBreadcrumb). */
  breadcrumb?: ReactNode;
  /** Service/entity logo url rendered in a bordered tile. */
  serviceLogoUrl?: string | null;
  /** Fallback leading icon (wrapped in a FeaturedIcon) when no logo is provided. */
  icon?: FC<{ className?: string }> | ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Inline badge next to the title (e.g. status / BETA). */
  badge?: ReactNode;
  /** Meta row (owner·domain·tier composite). */
  meta?: ReactNode;
  /** Primary action button (rendered left of secondary actions). */
  primaryAction?: ReactNode;
  /** Secondary actions (settings, manage, follow, etc.). */
  secondaryActions?: ReactNode;

  tabs: EntityDetailTab[];
  tabListType?: EntityDetailHeaderTabType;

  /** Uncontrolled initial tab (header owns the state). */
  defaultActiveKey?: string;
  /** Controlled active tab (escape hatch for URL-driven pages). */
  activeKey?: string;
  /** Called with the next tab key on selection change. */
  onTabChange?: (key: string) => void;
  /** When false, the header renders only the tab strip (page renders panels). */
  renderPanels?: boolean;

  variant?: HeaderShellVariant;
  className?: string;
  'data-testid'?: string;
}
