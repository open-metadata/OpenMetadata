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

import { NON_SERVICE_TYPE_ASSETS } from '../constants/Assets.constants';
import { DE_ACTIVE_COLOR } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { getEntityIcon } from './EntityIconUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';

export const getServiceIcon = (source: {
  entityType?: EntityType | string;
}) => {
  const isDataAsset = NON_SERVICE_TYPE_ASSETS.includes(
    source.entityType as EntityType
  );

  if (isDataAsset) {
    const iconEntityType =
      source.entityType === EntityType.TAG
        ? EntityType.CLASSIFICATION
        : source.entityType;

    return getEntityIcon(iconEntityType ?? '', 'service-icon w-7 h-7', {
      color: DE_ACTIVE_COLOR,
    });
  }

  // Decorative: the service name is always rendered alongside this logo, and the data-asset
  // branch above returns an unlabelled icon, so keep both out of the accessibility tree.
  return (
    <img
      aria-hidden
      alt=""
      className="inline service-icon h-7"
      src={serviceUtilClassBase.getServiceTypeLogo(source)}
    />
  );
};
