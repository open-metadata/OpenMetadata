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
import { Card, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { showErrorToast } from '../../../utils/ToastUtils';
import ExtractedMemoriesCard from '../../ContextCenter/ExtractedMemoriesCard/ExtractedMemoriesCard.component';
import ArticleStatusBadge from '../ArticleStatusBadge/ArticleStatusBadge.component';
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
  const { t } = useTranslation();
  const {
    entityRules,
    data,
    onUpdate,
    permissions: genericPermissions,
  } = useGenericContext<KnowledgePage>();

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

  const hasDataProductsPermission = useMemo(() => {
    return genericPermissions?.EditAll && !data?.deleted;
  }, [genericPermissions?.EditAll, data?.deleted]);

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
            hasPermission={hasDataProductsPermission}
            multiple={entityRules?.canAddMultipleDataProducts}
            onSave={handleDataProductsSave}
          />
        </div>
        <ReviewerLabelV2 />

        <TagsContainerV2
          newLook
          displayType={DisplayType.POPOVER}
          permission={permissions.EditAll || permissions.EditTags}
          selectedTags={tags}
          showTaskHandler={false}
          tagType={TagSource.Classification}
          onSelectionChange={updatePageTag}
        />

        <TagsContainerV2
          newLook
          displayType={DisplayType.POPOVER}
          permission={permissions.EditAll || permissions.EditTags}
          selectedTags={tags}
          showTaskHandler={false}
          tagType={TagSource.Glossary}
          onSelectionChange={updatePageTag}
        />

        <RelatedDataAssets
          hasPermission={permissions.EditAll}
          relatedDataAssets={knowledgePage?.['relatedEntities']}
          onRelatedDataAssetsUpdate={handleRelatedEntitiesUpdate}
        />

        <AttachmentWidget hasPermission={permissions.EditAll} />

        {knowledgePage?.id && (
          <div>
            {knowledgePage.processingStatus && (
              <div className="tw:flex tw:items-center tw:justify-between tw:mb-3">
                <Typography className="tw:text-quaternary">
                  {t('label.memory-extraction')}
                </Typography>
                <ArticleStatusBadge
                  error={knowledgePage.processingError}
                  status={knowledgePage.processingStatus}
                />
              </div>
            )}
            <ExtractedMemoriesCard sourceId={knowledgePage.id} />
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

export default KnowledgePageDetailRightPanel;
