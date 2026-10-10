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

import type { ProfileHeaderOverride } from '../../profileNavConfig';

export type ApplicationsView =
  | { type: 'list' }
  | { type: 'marketplace' }
  | { type: 'marketplace-detail'; fqn: string }
  | { type: 'install'; fqn: string }
  | { type: 'detail'; fqn: string };

export type InstallStep = 'details' | 'configure' | 'schedule';

/**
 * What a view pushes up to ApplicationsPanel; the panel adds the breadcrumbs
 * so every view shares the same Settings › Applications › … trail.
 */
export type ApplicationsHeader = Omit<
  ProfileHeaderOverride,
  'breadcrumbs' | 'onBreadcrumbAction'
> & { crumb?: string };

export interface ApplicationsViewProps {
  onNavigate: (view: ApplicationsView) => void;
  onHeaderChange: (header: ApplicationsHeader) => void;
}
