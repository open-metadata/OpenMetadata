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
import { FC } from 'react';
import { RouteProps } from 'react-router-dom';
import { App } from '../../../../generated/entity/applications/app';
import { AppMarketPlaceDefinition } from '../../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { LeftSidebarItem } from '../../../MyData/LeftSidebar/LeftSidebar.interface';

export interface LeftSidebarItemExample extends LeftSidebarItem {
  index: number;
}

/**
 * Interface defining the structure and capabilities of an application plugin.
 *
 * This interface allows plugins to extend the OpenMetadata application with
 * custom components, routes, and sidebar actions. Plugins can be installed
 * or uninstalled dynamically and provide modular functionality.
 */
export interface AppPlugin {
  /**
   * The unique name of the app received from the /apps endpoint.
   */
  name: string;

  /**
   * Indicates whether the app is currently installed and active.
   * Used to determine plugin availability and UI state.
   */
  isInstalled: boolean;

  /**
   * Optional method that returns a React component for the entire app details view.
   * If provided, this component will replace the default tabs interface.
   * It is the responsibility of this component to handle all app details functionality.
   *
   * @param app - The App entity containing application details and configuration
   * @returns A React functional component for the complete app details view,
   *          or null if the default tabs interface should be used.
   */
  getAppDetails?(app: App): FC | null;

  /**
   * Optional method that provides custom routes for the plugin.
   *
   * @returns An array of route properties that define the plugin's
   *          navigation structure and page routing.
   */
  getRoutes?(): Array<RouteProps>;

  /**
   * Optional method that provides custom sidebar actions for the plugin.
   *
   * @returns An array of sidebar items that will be displayed in the
   *          left sidebar when the plugin is active.
   */
  getSidebarActions?(): Array<LeftSidebarItemExample>;

  /**
   * Optional method that returns a React component for the app installation page.
   * If provided, this component will replace the default stepper and tabs interface
   * in the App Installation page.
   *
   * @param app - The AppMarketPlaceDefinition entity containing application details and configuration
   * @returns A React functional component for the complete app installation view,
   *          or null if the default installation interface should be used.
   */
  getAppInstallComponent?(app: AppMarketPlaceDefinition): FC | null;
}
