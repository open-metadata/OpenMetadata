/*
 *  Copyright 2023 Collate.
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
import { LeftSidebarItem } from '../components/MyData/LeftSidebar/LeftSidebar.interface';
import { SIDEBAR_LIST } from '../constants/LeftSidebar.constants';

class LeftSidebarClassBase {
  sidebarItems: Array<LeftSidebarItem>;

  constructor() {
    this.sidebarItems = SIDEBAR_LIST;
  }

  /**
   * getSidebarItems
   */
  public getSidebarItems(): Array<LeftSidebarItem> {
    return this.sidebarItems;
  }

  public setSidebarItems(items: Array<LeftSidebarItem>): void {
    this.sidebarItems = items;
  }
}

const leftSidebarClassBase = new LeftSidebarClassBase();

export default leftSidebarClassBase;

export { LeftSidebarClassBase };
