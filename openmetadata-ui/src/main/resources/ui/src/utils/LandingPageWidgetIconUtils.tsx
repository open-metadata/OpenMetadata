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

import classNames from 'classnames';
import defaultServiceIconUrl from '../assets/svg/default-service-icon.svg';
import customizeMyDataPageClassBase from './CustomizeMyDataPageClassBase';
import { DataAssetServiceLogo } from './DataAssetServiceUtils';
import type { LandingPageWidgetIconSource } from './LandingPageWidgetIconUtils.interface';
import searchClassBase from './SearchClassBase';
import { EntityIconSize, ENTITY_ICON_SIZE_CLASS_MAP } from './TableUtils';

export const getEntityIcon = (
  item: LandingPageWidgetIconSource,
  className?: string,
  size: EntityIconSize = EntityIconSize.Size32
) => {
  const iconClassName = classNames(className, ENTITY_ICON_SIZE_CLASS_MAP[size]);
  const entityType = item.entityType ?? item.type ?? '';

  if (item.serviceType) {
    const serviceIconUrl =
      customizeMyDataPageClassBase.getLandingPageWidgetServiceIconUrl(item);

    if (serviceIconUrl) {
      return (
        <img
          alt={item.name ?? item.serviceType}
          className={iconClassName}
          src={serviceIconUrl}
        />
      );
    }

    return (
      <DataAssetServiceLogo
        className={iconClassName}
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
        className={iconClassName}
        src={customIconUrl}
      />
    );
  }

  const entityIcon = searchClassBase.getEntityIcon(
    entityType,
    classNames('tw:text-quaternary tw:shrink-0', iconClassName)
  );

  if (entityIcon) {
    return entityIcon;
  }

  return (
    <img
      alt={item.name ?? entityType}
      className={iconClassName}
      src={defaultServiceIconUrl}
    />
  );
};
