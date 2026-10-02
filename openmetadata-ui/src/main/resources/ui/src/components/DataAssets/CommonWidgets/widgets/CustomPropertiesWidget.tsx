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
import { lazy } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import { getPrioritizedViewPermission } from '../../../../utils/PermissionsUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../../../common/CustomPropertyTable/CustomPropertyTable.interface';
import { EntityDetailWidgetSkeleton } from '../../../common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { CommonWidgetComponent, GenericEntity } from '../CommonWidgets.types';

type CustomPropertyTableComponent = <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import('../../../common/CustomPropertyTable/CustomPropertyTable').then(
      (m) => ({
        default: m.CustomPropertyTable,
      })
    )
  ),
  <EntityDetailWidgetSkeleton lineCount={5} />
) as CustomPropertyTableComponent;

export const CustomPropertiesWidget: CommonWidgetComponent = ({
  entityType,
}) => {
  const { data, permissions } = useGenericContext<GenericEntity>();
  // Mirrors this branch's pre-refactor CommonWidgets permission checks.
  const canEditCustomFields =
    Boolean(permissions.EditAll || permissions.EditCustomFields) &&
    !data.deleted;
  const canViewCustomFields = getPrioritizedViewPermission(
    permissions,
    Operation.ViewCustomFields
  );

  return (
    <CustomPropertyTable<EntityType.TABLE>
      isRenderedInRightPanel
      entityType={entityType as EntityType.TABLE}
      hasEditAccess={Boolean(canEditCustomFields)}
      hasPermission={canViewCustomFields}
      maxDataCap={5}
    />
  );
};
