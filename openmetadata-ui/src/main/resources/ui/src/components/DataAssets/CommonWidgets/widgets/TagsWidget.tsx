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
import { lazy, useMemo } from 'react';
import { TagSource } from '../../../../generated/type/tagLabel';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { EntityDetailWidgetSkeleton } from '../../../common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { DisplayType } from '../../../Tag/TagsViewer/TagsViewer.interface';
import {
  useTagsUpdateHandler,
  useTierSplit,
  useUpdatedEntityData,
} from '../CommonWidgets.hooks';
import { CommonWidgetComponent, GenericEntity } from '../CommonWidgets.types';

const TagsContainerV2 = withSuspenseFallback(
  lazy(() => import('../../../Tag/TagsContainerV2/TagsContainerV2')),
  <EntityDetailWidgetSkeleton />
);

export const TagsWidget: CommonWidgetComponent = ({ showTaskHandler }) => {
  const { data, type, permissions, isVersionView } =
    useGenericContext<GenericEntity>();
  const updatedData = useUpdatedEntityData(data, isVersionView);
  const { tier, tags } = useTierSplit(updatedData);
  const { canEditTags } = useMemo(
    () => getDerivedPermissionFlags(permissions, data.deleted ?? false),
    [permissions, data.deleted]
  );
  const { onTagsChange, confirmationModal } = useTagsUpdateHandler(
    data,
    tier,
    updatedData
  );

  return (
    <>
      <TagsContainerV2
        newLook
        useGenericControls
        displayType={DisplayType.READ_MORE}
        entityFqn={updatedData.fullyQualifiedName}
        entityType={type}
        permission={canEditTags && !isVersionView}
        selectedTags={tags}
        showTaskHandler={showTaskHandler && !isVersionView}
        tagType={TagSource.Classification}
        onSelectionChange={onTagsChange}
      />
      {confirmationModal}
    </>
  );
};
