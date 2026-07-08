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

import type { ReactNode } from 'react';

export type HeaderShellVariant = 'flat' | 'gradient';

export interface HeaderShellProps {
  /** Leading visual: featured icon tile, service logo, or avatar. */
  leading?: ReactNode;
  /** Breadcrumb row rendered above the title. */
  breadcrumb?: ReactNode;
  /** Title text or node. Strings are wrapped in a heading Typography. */
  title: ReactNode;
  /** Subtitle / description under the title. Strings are styled automatically. */
  subtitle?: ReactNode;
  /** Inline badge rendered next to the title (e.g. BETA). */
  badge?: ReactNode;
  /** Meta row under the title (owner·domain·tier). */
  meta?: ReactNode;
  /** Right-aligned actions (search, buttons, view toggle). */
  actions?: ReactNode;
  /** Footer row rendered full-width under the header, typically the tab strip. */
  footer?: ReactNode;
  /** Visual treatment. 'gradient' applies the brand-tinted card per Figma. */
  variant?: HeaderShellVariant;
  className?: string;
  'data-testid'?: string;
}
