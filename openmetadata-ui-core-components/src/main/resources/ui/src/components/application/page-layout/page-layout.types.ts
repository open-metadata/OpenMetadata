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
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * `content` (default) keeps the header fixed while `PageLayout.Content` and the
 * side panels scroll on their own. `page` lets the whole layout scroll as one
 * document, so the header scrolls away with the content beneath it.
 */
export type PageLayoutScroll = 'content' | 'page';

/** A pixel number (`230` → `230px`) or any CSS length string (`'16rem'`). */
export type PanelSize = number | string;

export interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Scroll behaviour. `content` (default) fixes the header and scrolls the
   * content/panels independently; `page` scrolls the whole layout as one.
   */
  scroll?: PageLayoutScroll;
  /**
   * Sets the browser tab title (rendered through `DocumentTitle`, appending the
   * brand name). Requires a `HelmetProvider` above this component.
   */
  pageTitle?: string;
  /**
   * Fill the parent's height (the default — the app shell wants a full-height
   * page). Set `false` for content that should grow with its children.
   */
  fullHeight?: boolean;
  children?: ReactNode;
}

export interface PageLayoutHeaderProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

export interface PageLayoutPanelProps extends HTMLAttributes<HTMLElement> {
  /** Panel width — px number or CSS length. */
  width?: PanelSize;
  /** Draw the divider between the panel and the content. Default `true`. */
  bordered?: boolean;
  /**
   * Accessible name for this complementary landmark. Every panel is an
   * `<aside>`; a name lets assistive tech tell two panels apart. Provide one
   * unless an `aria-labelledby` is supplied instead.
   */
  'aria-label'?: string;
  children?: ReactNode;
}

export interface PageLayoutContentProps extends HTMLAttributes<HTMLElement> {
  /** Center the content and cap it at `maxWidth`. */
  center?: boolean;
  /** Max content width when `center` is set. Default `1200px`. */
  maxWidth?: PanelSize;
  children?: ReactNode;
}
