/*
 *  Copyright 2024 Collate.
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

export interface LeftSidebarItem {
  key: string;
  isBeta?: boolean;
  title: string;
  redirect_url?: string;
  icon: SvgComponent;
  dataTestId: string;
  children?: Array<LeftSidebarItem>;
  /**
   * Optional side-effect fired BEFORE the `redirect_url` navigation
   * completes. Use for cross-cutting concerns that need to run on click
   * — for example, app-mode switches that must take effect before the
   * target route resolves. Runs synchronously inside the `<NavLink>`'s
   * onClick; the navigation always proceeds because no event is exposed
   * to the callback.
   */
  onClick?: () => void;
}

export interface LeftSidebarItemProps {
  data: {
    key: string;
    title: string;
    dataTestId: string;
    redirect_url?: string;
    icon: SvgComponent;
    isBeta?: boolean;
    onClick?: () => void;
  };
}
