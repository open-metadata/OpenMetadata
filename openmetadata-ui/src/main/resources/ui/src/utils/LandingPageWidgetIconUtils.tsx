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

import { File06 } from '@untitledui/icons';
import { EntityType } from '../enums/entity.enum';
import customizeMyDataPageClassBase from './CustomizeMyDataPageClassBase';
import { DataAssetServiceLogo } from './DataAssetServiceUtils';
import {
  LANDING_WIDGET_DEFAULT_ICON_URL,
  LANDING_WIDGET_ENTITY_ICON_URL_MAP,
} from './LandingPageWidgetIconUtils.constants';
import type { LandingPageWidgetIconSource } from './LandingPageWidgetIconUtils.interface';

export const getEntityIcon = (
  item: LandingPageWidgetIconSource,
  className = 'w-8 h-8'
) => {
  const entityType = item.entityType ?? item.type ?? '';

  if (item.serviceType) {
    const serviceIconUrl =
      customizeMyDataPageClassBase.getLandingPageWidgetServiceIconUrl(item);

    if (serviceIconUrl) {
      return (
        <img
          alt={item.name ?? item.serviceType}
          className={className}
          src={serviceIconUrl}
        />
      );
    }

    return (
      <DataAssetServiceLogo
        className={className}
        serviceType={item.serviceType}
      />
    );
  }

  if(entityType === EntityType.KNOWLEDGE_PAGE){
    return <File06 className='tw:text-quaternary' strokeWidth={1.5} />
  }

  const iconUrl =
    customizeMyDataPageClassBase.getLandingPageWidgetEntityIconUrl(item) ??
    LANDING_WIDGET_ENTITY_ICON_URL_MAP[entityType] ??
    LANDING_WIDGET_DEFAULT_ICON_URL;

  return (
    <img alt={item.name ?? entityType} className={className} src={iconUrl} />
  );
};
