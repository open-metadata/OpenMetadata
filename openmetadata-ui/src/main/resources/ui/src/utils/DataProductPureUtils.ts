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
import type { EntityReference } from '../generated/entity/data/table';
import type { DataProduct } from '../generated/entity/domains/dataProduct';
import type { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import {
  convertDataProductsToEntityReferences as convertDataProductsToEntityReferencesUtil,
  convertEntityReferencesToDataProducts as convertEntityReferencesToDataProductsUtil,
} from './EntityReferenceUtils';

export const convertDataProductsToEntityReferences = (
  dataProducts: DataProduct[]
): EntityReference[] => {
  return convertDataProductsToEntityReferencesUtil(dataProducts);
};

export const convertEntityReferencesToDataProducts = (
  refs: EntityReference[]
): DataProduct[] => {
  return convertEntityReferencesToDataProductsUtil(refs);
};

export const getQueryFilterForDataProductPorts = (
  dataProductFqn: string
): QueryFilterInterface => {
  return {
    query: {
      bool: {
        must: [{ term: { 'dataProducts.fullyQualifiedName': dataProductFqn } }],
      },
    },
  };
};
