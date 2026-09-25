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
import { isEmpty } from 'lodash';
import { lazy, useMemo } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { Dashboard } from '../../../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../../../generated/entity/data/dashboardDataModel';
import { Directory } from '../../../../generated/entity/data/directory';
import { Glossary } from '../../../../generated/entity/data/glossary';
import { Mlmodel } from '../../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../../generated/entity/data/searchIndex';
import { Spreadsheet } from '../../../../generated/entity/data/spreadsheet';
import { StoredProcedure } from '../../../../generated/entity/data/storedProcedure';
import { Table } from '../../../../generated/entity/data/table';
import { Topic } from '../../../../generated/entity/data/topic';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { EntityDetailWidgetSkeleton } from '../../../common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { useUpdatedEntityData } from '../CommonWidgets.hooks';
import { CommonWidgetComponent, GenericEntity } from '../CommonWidgets.types';

const Description = withSuspenseFallback(
  lazy(() => import('../../../common/EntityDescription/Description')),
  <EntityDetailWidgetSkeleton />
);

const isDescriptionExpandedFor = (
  entityType: EntityType,
  data: GenericEntity
): boolean => {
  const expansionCheckers: Partial<Record<EntityType, () => boolean>> = {
    [EntityType.TABLE]: () => isEmpty((data as unknown as Table).columns),
    [EntityType.DASHBOARD]: () =>
      isEmpty((data as unknown as Dashboard).charts),
    [EntityType.DASHBOARD_DATA_MODEL]: () =>
      isEmpty((data as unknown as DashboardDataModel).columns),
    [EntityType.MLMODEL]: () =>
      isEmpty((data as unknown as Mlmodel).mlFeatures),
    [EntityType.PIPELINE]: () => isEmpty((data as unknown as Pipeline).tasks),
    [EntityType.TOPIC]: () =>
      isEmpty((data as unknown as Topic).messageSchema?.schemaFields),
    [EntityType.SEARCH_INDEX]: () =>
      isEmpty((data as unknown as SearchIndex).fields),
    [EntityType.STORED_PROCEDURE]: () =>
      isEmpty(
        (data as unknown as StoredProcedure).code ??
          (data as unknown as StoredProcedure).storedProcedureCode
      ),
    [EntityType.GLOSSARY]: () => (data as unknown as Glossary).termCount === 0,
    [EntityType.DOMAIN]: () => true,
    [EntityType.METRIC]: () => true,
    [EntityType.FILE]: () => true,
    [EntityType.WORKSHEET]: () => true,
    [EntityType.DIRECTORY]: () =>
      isEmpty((data as unknown as Directory).children),
    [EntityType.SPREADSHEET]: () =>
      isEmpty((data as unknown as Spreadsheet).worksheets),
  };

  return expansionCheckers[entityType]?.() ?? false;
};

export const DescriptionWidget: CommonWidgetComponent = ({
  entityType,
  widgetConfig,
}) => {
  const { data, type, permissions, isVersionView, onUpdate } =
    useGenericContext<GenericEntity>();
  const updatedData = useUpdatedEntityData(data, isVersionView);
  // Mirrors this branch's pre-refactor CommonWidgets permission checks.
  const canEditDescription =
    Boolean(permissions.EditDescription || permissions.EditAll) &&
    !data.deleted;
  const isDescriptionExpanded = useMemo(
    () => isDescriptionExpandedFor(entityType, data),
    [entityType, data]
  );

  // Large widgets show the full description; small ones clamp behind "read more".
  const isLarge = widgetConfig.config?.size === 'large';
  // removeBlur drops the read-more toggle entirely; isDescriptionExpanded only
  // opens it expanded, so small widgets can still collapse long text.
  const removeBlur = isLarge || type === EntityType.DOMAIN;

  return (
    <Description
      showSuggestions
      wrapInCard
      description={updatedData.description}
      entityFullyQualifiedName={data?.fullyQualifiedName ?? ''}
      entityName={getEntityName(updatedData)}
      entityType={type}
      hasEditAccess={canEditDescription}
      isDescriptionExpanded={isDescriptionExpanded}
      owner={data.owners}
      removeBlur={removeBlur}
      showActions={!data.deleted}
      onDescriptionUpdate={async (value: string) => {
        if (value !== updatedData.description) {
          await onUpdate(
            {
              ...data,
              description: value === '' ? undefined : value,
            },
            'description'
          );
        }
      }}
    />
  );
};
