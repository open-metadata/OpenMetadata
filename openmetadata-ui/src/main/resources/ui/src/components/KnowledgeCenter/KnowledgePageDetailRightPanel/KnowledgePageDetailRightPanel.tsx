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
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { FC, useCallback, useMemo } from 'react';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericProvider';
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
import RelatedDataAssets from '../RelatedDataAssets/RelatedDataAssets';
import './knowledge-page.less';
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
    <div
      className="knowledge-page-right-panel"
      data-testid="knowledge-page-right-panel">
      <Row gutter={[0, 24]}>
        <Col span={24}>
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
        </Col>
        <Col span={24}>
          <ReviewerLabelV2 />
        </Col>
        <Col span={24}>
          <TagsContainerV2
            newLook
            displayType={DisplayType.POPOVER}
            permission={permissions.EditAll || permissions.EditTags}
            selectedTags={tags}
            showTaskHandler={false}
            tagType={TagSource.Classification}
            onSelectionChange={updatePageTag}
          />
        </Col>
        <Col span={24}>
          <TagsContainerV2
            newLook
            displayType={DisplayType.POPOVER}
            permission={permissions.EditAll || permissions.EditTags}
            selectedTags={tags}
            showTaskHandler={false}
            tagType={TagSource.Glossary}
            onSelectionChange={updatePageTag}
          />
        </Col>
        <Col span={24}>
          <RelatedDataAssets
            hasPermission={permissions.EditAll}
            relatedDataAssets={knowledgePage?.['relatedEntities']}
            onRelatedDataAssetsUpdate={handleRelatedEntitiesUpdate}
          />
        </Col>
      </Row>
    </div>
  );
};

export default KnowledgePageDetailRightPanel;
