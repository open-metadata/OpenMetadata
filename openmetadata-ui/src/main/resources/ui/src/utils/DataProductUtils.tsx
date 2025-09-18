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
import { EntityType } from '../enums/entity.enum';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { getEntityIcon } from './TableUtils';

/**
 * Determines the appropriate icon for a data product based on its properties
 * Uses the existing getEntityIcon function for consistency with the rest of the system
 * @param dataProduct - The data product entity
 * @param size - Optional size for the icon (default: 32)
 * @returns JSX element representing the icon
 */
export const getDataProductIcon = (
  dataProduct: DataProduct,
  size = 32
): JSX.Element => {
  // If data product has a custom icon URL, use it
  if (dataProduct.style?.iconURL) {
    return (
      <img
        alt={dataProduct.displayName || dataProduct.name}
        className="align-middle object-contain"
        data-testid="data-product-custom-icon"
        height={size}
        src={dataProduct.style.iconURL}
        width={size}
      />
    );
  }

  // Use existing getEntityIcon function for default data product icon
  const defaultIcon = getEntityIcon(EntityType.DATA_PRODUCT, '', {
    fontSize: `${size}px`,
  });

  return defaultIcon || <></>;
};
