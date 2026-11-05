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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { createContext, useContext } from 'react';

/** Crumb id the header uses for its own close / minimize buttons. */
export const CUSTOMIZE_CHROME_BACK_ID = 'back';

export interface CustomizePageChrome {
  breadcrumbs: BreadcrumbItemType[];
  /** Leave the customize page towards a crumb id or {@link CUSTOMIZE_CHROME_BACK_ID}. */
  onNavigate: (id: string) => void;
}

/**
 * Provided only by the persona settings fullscreen view. The legacy
 * `/customize-page` route has no provider, so the header keeps its
 * router-based close and classic look there.
 */
export const CustomizePageChromeContext =
  createContext<CustomizePageChrome | null>(null);

export const useCustomizePageChrome = () =>
  useContext(CustomizePageChromeContext);
