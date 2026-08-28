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
import { Card } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useMemo } from 'react';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { ReviewerLabelV2 } from '../../../components/DataAssets/ReviewerLabelV2/ReviewerLabelV2';
import DataProductsContainer from '../../../components/DataProducts/DataProductsContainer/DataProductsContainer.component';
import TagsContainerV2 from '../../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../../components/Tag/TagsViewer/TagsViewer.interface';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import { EntityTags } from '../../../Models';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { showErrorToast } from '../../../utils/ToastUtils';
import AttachmentWidget from '../AttachmentWidget/AttachmentWidget';
import RelatedDataAssets from '../RelatedDataAssets/RelatedDataAssets';

interface KnowledgePageDetailRightPanelProps {
  permissions: OperationPermission;
  tags: Array<EntityTags>;
  knowledgePage?: KnowledgePage;
  updatePageTag: (tags: Array<EntityTags>) => Promise<void>;
  handleRelatedEntitiesUpdate: (
    relatedEntities?: Array<EntityReference>
  ) => Promise<void>;
}

const KnowledgePageDetailRightPanel: FC<KnowledgePageDetailRightPanelProps> = ({
  knowledgePage,
  permissions,
  tags,
  updatePageTag,
  handleRelatedEntitiesUpdate,
}) => {
  const { entityRules, data, onUpdate } = useGenericContext<KnowledgePage>();

  const handleDataProductsSave = useCallback(
    async (selectedDataProducts: DataProduct[]) => {
      try {
        const updatedEntity = { ...data };
        updatedEntity.dataProducts = selectedDataProducts.map((dp) => ({
          id: dp.id,
          fullyQualifiedName: dp.fullyQualifiedName,
          name: dp.name,
          displayName: dp.displayName,
          type: EntityType.DATA_PRODUCT,
        }));

        await onUpdate(updatedEntity);
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [data, onUpdate]
  );

  // Named-flag derivation (Task 8 sweep): the `permissions` prop and useGenericContext()'s own
  // `permissions` are the same object here — this component's sole caller
  // (KnowledgePageDetailComponent.tsx) passes the identical `permissions` value to both
  // GenericProvider and this component — so one derivation off the prop covers both the old
  // `genericPermissions?.EditAll` (now `canEditAll`) and the old `permissions.EditAll ||
  // permissions.EditTags` reads (now `canEditTags`, the same explicit-deny-wins fix as the
  // sanctioned canViewBasic precedent, Task 6 Finding 1). `deleted` comes from `data?.deleted`
  // (context), matching the one old usage that did gate on it (`hasDataProductsPermission`);
  // the tags/related-assets reads gain the same deleted-gating for consistency, matching the
  // hook's "soft-deleted entity is read-only" design intent.
  const { canEditAll, canEditTags } = useMemo(
    () => getDerivedPermissionFlags(permissions, data?.deleted),
    [permissions, data?.deleted]
  );

  return (
    <Card
      className="tw:h-full tw:p-5 tw:overflow-auto"
      data-testid="knowledge-page-right-panel">
      <Card.Content className="tw:p-0 tw:flex tw:flex-col tw:gap-6">
        <div data-testid="KnowledgePanel.DataProducts">
          <DataProductsContainer
            newLook
            activeDomains={data?.domains ?? []}
            dataProducts={data?.dataProducts ?? []}
            hasPermission={canEditAll}
            multiple={entityRules?.canAddMultipleDataProducts}
            onSave={handleDataProductsSave}
          />
        </div>
        <ReviewerLabelV2 />

        <TagsContainerV2
          newLook
          displayType={DisplayType.POPOVER}
          permission={canEditTags}
          selectedTags={tags}
          showTaskHandler={false}
          tagType={TagSource.Classification}
          onSelectionChange={updatePageTag}
        />

        <TagsContainerV2
          newLook
          displayType={DisplayType.POPOVER}
          permission={canEditTags}
          selectedTags={tags}
          showTaskHandler={false}
          tagType={TagSource.Glossary}
          onSelectionChange={updatePageTag}
        />

        <RelatedDataAssets
          hasPermission={canEditAll}
          relatedDataAssets={knowledgePage?.['relatedEntities']}
          onRelatedDataAssetsUpdate={handleRelatedEntitiesUpdate}
        />

        <AttachmentWidget entityFqn={knowledgePage?.fullyQualifiedName} />
      </Card.Content>
    </Card>
  );
};

export default KnowledgePageDetailRightPanel;
