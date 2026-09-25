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
import { lazy, useCallback } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { getEntityReferenceFromEntity } from '../../../../utils/EntityReferenceUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { EntityDetailWidgetSkeleton } from '../../../common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { CommonWidgetComponent, GenericEntity } from '../CommonWidgets.types';

const DataProductsContainer = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../../DataProducts/DataProductsContainer/DataProductsContainer.component'
      )
  ),
  <EntityDetailWidgetSkeleton />
);

export const DataProductsWidget: CommonWidgetComponent = () => {
  const { data, permissions, entityRules, isRulesLoaded, onUpdate } =
    useGenericContext<GenericEntity>();
  // Mirrors this branch's pre-refactor CommonWidgets permission checks.
  const canEditAll = Boolean(permissions.EditAll) && !data.deleted;
  const handleDataProductsSave = useCallback(
    async (dataProducts: DataProduct[]) => {
      const updatedDataProducts = dataProducts.map((dataProduct) =>
        getEntityReferenceFromEntity(dataProduct, EntityType.DATA_PRODUCT)
      );

      await onUpdate({ ...data, dataProducts: updatedDataProducts });
    },
    [data, onUpdate]
  );

  return (
    <DataProductsContainer
      newLook
      activeDomains={data.domains}
      dataProducts={data.dataProducts ?? []}
      hasPermission={canEditAll}
      multiple={isRulesLoaded && entityRules.canAddMultipleDataProducts}
      requireDomainForDataProduct={
        !isRulesLoaded || entityRules.requireDomainForDataProduct
      }
      onSave={handleDataProductsSave}
    />
  );
};
