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

import {
  LANDING_WIDGET_DEFAULT_ICON_URL,
  LANDING_WIDGET_ENTITY_ICON_URL_MAP,
} from './LandingPageWidgetIconUtils.constants';
import { DataAssetServiceLogo } from './DataAssetServiceUtils';

interface LandingPageWidgetIconSource {
  name?: string;
  entityType?: string;
  type?: string;
  serviceType?: string;
}

export const getLandingPageWidgetIcon = (
  item: LandingPageWidgetIconSource,
  className = 'w-8 h-8'
) => {
  const entityType = item.entityType ?? item.type ?? '';
  const iconUrl =
    LANDING_WIDGET_ENTITY_ICON_URL_MAP[entityType] ??
    LANDING_WIDGET_DEFAULT_ICON_URL;

  if (item.serviceType) {
    return (
      <DataAssetServiceLogo
        className={className}
        serviceType={item.serviceType}
      />
    );
  }

  return (
    <img
      alt={item.name ?? entityType}
      className={className}
      src={iconUrl}
    />
  );
};
