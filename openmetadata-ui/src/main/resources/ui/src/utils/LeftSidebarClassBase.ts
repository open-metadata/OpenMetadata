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
import { contextCenterModule } from '../components/discovery/context-center/contextCenter.module';
import { entityModule } from '../components/discovery/entity/entity.module';
import { exploreModule } from '../components/discovery/explore/explore.module';
import { homeModule } from '../components/discovery/home/home.module';
import { personalSpaceModule } from '../components/discovery/personal-space/personalSpace.module';
import { governModule } from '../components/governance/govern/govern.module';
import { marketplaceModule } from '../components/governance/marketplace/marketplace.module';
import { connectionsModule } from '../components/integration/connections.module';
import { LeftSidebarItem } from '../components/MyData/LeftSidebar/LeftSidebar.interface';
import { observabilityModule } from '../components/observability/ObservabilityModule/observability.module';
import { AppModule } from '../components/platform/ai-shell/AppModule.types';
import {
  SIDEBAR_LIST,
  SIDEBAR_NESTED_KEYS,
} from '../constants/LeftSidebar.constants';

/**
 * OSS modules for the AI app-mode shell — the sidebar entries, their
 * owned routes and sub-navs that appear for every consumer. Ordered by
 * `navOrder` for readability; `useAllAppModules` sorts regardless.
 */
const APP_MODE_MODULES: Array<AppModule> = [
  homeModule,
  exploreModule,
  entityModule,
  connectionsModule,
  observabilityModule,
  governModule,
  contextCenterModule,
  marketplaceModule,
  personalSpaceModule,
];

class LeftSidebarClassBase {
  sidebarItems: Array<LeftSidebarItem>;
  appModeModules: Array<AppModule>;

  constructor() {
    this.sidebarItems = SIDEBAR_LIST;
    this.appModeModules = APP_MODE_MODULES;
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

  public getSidebarNestedKeys(): Record<string, string> {
    return SIDEBAR_NESTED_KEYS;
  }

  /**
   * The modules backing the AI app-mode sidebar and its route table.
   * This is the sibling of `getSidebarItems()` for the AI layout — a
   * downstream build (Collate) overrides it to append its own modules, the
   * same way it extends the Classic sidebar via `getSidebarItems()`. AI
   * is an app layout, so its modules are owned here rather than contributed by
   * an installed plugin.
   */
  public getAppModeModules(): Array<AppModule> {
    return this.appModeModules;
  }

  public setAppModeModules(modules: Array<AppModule>): void {
    this.appModeModules = modules;
  }
}

const leftSidebarClassBase = new LeftSidebarClassBase();

export default leftSidebarClassBase;

export { LeftSidebarClassBase };
