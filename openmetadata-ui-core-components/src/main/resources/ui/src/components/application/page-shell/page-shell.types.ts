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
import type { FC, HTMLAttributes, ReactNode } from 'react';

/**
 * Sub nav has three states rather than two: a page with no second level needs
 * the column gone, not merely narrow. `hidden` keeps the column mounted at zero
 * width so it animates out instead of popping.
 */
export type SubNavState = 'expanded' | 'collapsed' | 'hidden';

/**
 * Accessible names for the shell's own controls. The shell has no default
 * strings of its own — the consuming app owns its i18n, the same way
 * `PageLayout`'s panels take their `aria-label` from the caller.
 */
export interface PageShellLabels {
  collapseMainNav: string;
  expandMainNav: string;
  collapseSubNav: string;
  expandSubNav: string;
  hideSubNav: string;
  showSubNav: string;
}

export interface PageShellProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  labels: PageShellLabels;
  /** Sets `document.title` when present. */
  pageTitle?: string;
  /** Controlled main-nav width. Omit to let the shell own it. */
  isMainNavCollapsed?: boolean;
  defaultMainNavCollapsed?: boolean;
  onMainNavCollapsedChange?: (isCollapsed: boolean) => void;
  /** Controlled sub-nav state. Omit to let the shell own it. */
  subNav?: SubNavState;
  defaultSubNav?: SubNavState;
  onSubNavChange?: (state: SubNavState) => void;
  /** Width of an expanded nav column, in px. */
  navWidth?: number;
  /** Width of a collapsed nav column, in px. */
  railWidth?: number;
  children?: ReactNode;
}

export interface PageShellRegionProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export interface PageShellNavColumnProps extends PageShellRegionProps {
  /**
   * Rendered at the foot of the column, below the scrolling area. The main nav
   * uses it for the sub-nav visibility control.
   */
  footer?: ReactNode;
}

export interface PageShellNavItemProps
  extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'title'> {
  /**
   * Leading icon. Required, because it is the item's only visible content once
   * its column collapses to a rail.
   */
  icon: FC<{ className?: string }> | ReactNode;
  /**
   * Item text. Shown beside the icon while the column is expanded, and kept as
   * the accessible name either way.
   */
  label: string;
  isActive?: boolean;
  /** Renders an anchor when set, a button otherwise. */
  href?: string;
}
