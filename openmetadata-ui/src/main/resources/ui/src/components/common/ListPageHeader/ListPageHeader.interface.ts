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

import { FC, ReactNode, SVGProps } from 'react';

export interface ListPageHeaderConfig {
  icon: FC<SVGProps<SVGSVGElement>>;
  titleKey: string;
  subtitleKey: string;
  addLabelKey: string;
}

export interface ListPageHeaderRenderProps {
  onAddClick: () => void;
  createPermission: boolean;
  count: number;
  /**
   * The list page's search input, supplied by the list page that owns the
   * search state and debounce. Optional so the header keeps working against a
   * host page that predates the render-prop `search` slot.
   */
  search?: ReactNode;
}
