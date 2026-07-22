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

import defaultServiceIconUrl from '../assets/svg/default-service-icon.svg';
import customizeMyDataPageClassBase from './CustomizeMyDataPageClassBase';
import { DataAssetServiceLogo } from './DataAssetServiceUtils';
import type { LandingPageWidgetIconSource } from './LandingPageWidgetIconUtils.interface';
import searchClassBase from './SearchClassBase';

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


  const customIconUrl =
    customizeMyDataPageClassBase.getLandingPageWidgetEntityIconUrl(item);

  if (customIconUrl) {
    return (
      <img
        alt={item.name ?? entityType}
        className={className}
        src={customIconUrl}
      />
    );
  }

  const entityIcon = searchClassBase.getEntityIcon(entityType, `tw:text-quaternary tw:shrink-0 ${className}`);

  if (entityIcon) {
    return entityIcon;
  }

  return (
    <img
      alt={item.name ?? entityType}
      className={className}
      src={defaultServiceIconUrl}
    />
  );
};
