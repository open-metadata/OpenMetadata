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

import type { ServiceTypes } from 'Models';
import { PLACEHOLDER_SETTING_CATEGORY, ROUTES } from '../constants/constants';
import { GlobalSettingsMenuCategory } from '../constants/GlobalSettings.constants';
import {
  getAddServicePath,
  getEditConnectionPath,
  getEditIngestionPath,
  getLogsViewerPath,
  getPathByServiceFQN,
  getServiceDetailsPath,
  getSettingPath,
} from './RouterUtils';
import { getServiceRouteFromServiceType } from './ServiceUtils';

class ConnectionsRouterClassBase {
  public setEmbeddedMode(_flag: boolean): void {
    // no-op in base; overridden in Collate
  }

  public isEmbeddedMode(): boolean {
    return false;
  }

  public getSettingsServicesPath(serviceCategory?: string): string {
    if (serviceCategory) {
      return getSettingPath(
        GlobalSettingsMenuCategory.SERVICES,
        getServiceRouteFromServiceType(serviceCategory as ServiceTypes)
      );
    }

    return ROUTES.SETTINGS_WITH_CATEGORY.replace(
      PLACEHOLDER_SETTING_CATEGORY,
      GlobalSettingsMenuCategory.SERVICES
    );
  }

  public getServiceDetailsPath(
    serviceCategory: string,
    fqn: string,
    tab?: string
  ): string {
    return getServiceDetailsPath(fqn, serviceCategory, tab);
  }

  public getEditConnectionPath(serviceCategory: string, fqn: string): string {
    return getEditConnectionPath(serviceCategory, fqn);
  }

  public getAddServicePath(serviceCategory: string): string {
    return getAddServicePath(serviceCategory);
  }

  public getPathByServiceFQN(serviceCategory: string, fqn: string): string {
    return getPathByServiceFQN(serviceCategory, fqn);
  }

  public getEditIngestionPath(
    serviceCategory: string,
    fqn: string,
    ingestionFqn: string,
    ingestionType: string
  ): string {
    return getEditIngestionPath(
      serviceCategory,
      fqn,
      ingestionFqn,
      ingestionType
    );
  }

  public getLogsViewerPath(
    logEntityType: string,
    logEntityName: string,
    ingestionName: string
  ): string {
    return getLogsViewerPath(logEntityType, logEntityName, ingestionName);
  }
}

const connectionsRouterClassBase = new ConnectionsRouterClassBase();

export default connectionsRouterClassBase;
export { ConnectionsRouterClassBase };
