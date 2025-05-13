/*
 *  Copyright 2023 Collate.
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
import { useMemo } from 'react';
import DescriptionV1 from '../../../../components/common/EntityDescription/DescriptionV1';
import { EntityField } from '../../../../constants/Feeds.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../../constants/ResizablePanel.constants';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import {
  DataProduct,
  TagLabel,
  TagSource,
} from '../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../generated/entity/domains/domain';
import { ChangeDescription } from '../../../../generated/entity/type';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../../utils/EntityVersionUtils';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import { OwnerLabelV2 } from '../../../DataAssets/OwnerLabelV2/OwnerLabelV2';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../../Tag/TagsViewer/TagsViewer.interface';
import '../../domain.less';
import { DomainExpertWidget } from '../../DomainExpertsWidget/DomainExpertWidget';
import { DomainTypeWidget } from '../../DomainTypeWidget/DomainTypeWidget';
import {
  DocumentationEntity,
  DocumentationTabProps,
} from './DocumentationTab.interface';

const DocumentationTab = ({
  isVersionsView = false,
  type = DocumentationEntity.DOMAIN,
}: DocumentationTabProps) => {
  const resourceType =
    type === DocumentationEntity.DOMAIN
      ? ResourceEntity.DOMAIN
      : ResourceEntity.DATA_PRODUCT;
  const {
    data: domain,
    onUpdate,
    permissions,
  } = useGenericContext<Domain | DataProduct>();

  const {
    editDescriptionPermission,
    editCustomAttributePermission,
    viewAllPermission,
    editTagsPermission,
    editGlossaryTermsPermission,
  } = useMemo(() => {
    if (isVersionsView) {
      return {
        editDescriptionPermission: false,
        editOwnerPermission: false,
        editAllPermission: false,
        editCustomAttributePermission: false,
        editTagsPermission: false,
        editGlossaryTermsPermission: false,
      };
    }

    const editDescription = permissions?.EditDescription;

    const editOwner = permissions?.EditOwners;

    const editAll = permissions?.EditAll;

    const editCustomAttribute = permissions?.EditCustomFields;

    const viewAll = permissions?.ViewAll;

    const editTags = permissions?.EditTags;

    const editGlossaryTerms = permissions?.EditGlossaryTerms;

    return {
      editDescriptionPermission: editAll || editDescription,
      editOwnerPermission: editAll || editOwner,
      editAllPermission: editAll,
      editCustomAttributePermission: editAll || editCustomAttribute,
      editTagsPermission: editAll || editTags,
      editGlossaryTermsPermission: editAll || editGlossaryTerms,
      viewAllPermission: viewAll,
    };
  }, [permissions, isVersionsView, resourceType]);

  const description = useMemo(
    () =>
      isVersionsView
        ? getEntityVersionByField(
            domain.changeDescription as ChangeDescription,
            EntityField.DESCRIPTION,
            domain.description
          )
        : domain.description,

    [domain, isVersionsView]
  );

  const onTagsUpdate = async (updatedTags: TagLabel[]) => {
    const updatedDomain = {
      ...domain,
      tags: updatedTags,
    };
    await onUpdate(updatedDomain);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (domain.description !== updatedHTML) {
      const updatedTableDetails = {
        ...domain,
        description: updatedHTML,
      };
      await onUpdate(updatedTableDetails);
    }
  };

  return (
    <ResizablePanels
      className="h-full domain-height-with-resizable-panel"
      firstPanel={{
        className: 'domain-resizable-panel-container',
        children: (
          <DescriptionV1
            removeBlur
            wrapInCard
            description={description}
            entityName={getEntityName(domain)}
            entityType={EntityType.DOMAIN}
            hasEditAccess={editDescriptionPermission}
            showCommentsIcon={false}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        ),
        ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
      }}
      secondPanel={{
        wrapInCard: true,
        children: (
          <div className="d-flex flex-column gap-5">
            <OwnerLabelV2 dataTestId="domain-owner-name" />

            <TagsContainerV2
              newLook
              displayType={DisplayType.READ_MORE}
              entityFqn={domain.fullyQualifiedName}
              entityType={EntityType.DOMAIN}
              permission={editTagsPermission}
              selectedTags={domain.tags ?? []}
              showTaskHandler={false}
              tagType={TagSource.Classification}
              onSelectionChange={async (updatedTags: TagLabel[]) =>
                await onTagsUpdate(updatedTags)
              }
            />

            <TagsContainerV2
              newLook
              displayType={DisplayType.READ_MORE}
              entityFqn={domain.fullyQualifiedName}
              entityType={EntityType.DOMAIN}
              permission={editGlossaryTermsPermission}
              selectedTags={domain.tags ?? []}
              showTaskHandler={false}
              tagType={TagSource.Glossary}
              onSelectionChange={async (updatedTags: TagLabel[]) =>
                await onTagsUpdate(updatedTags)
              }
            />

            <DomainExpertWidget />

            {type === DocumentationEntity.DOMAIN && <DomainTypeWidget />}

            {domain && type === DocumentationEntity.DATA_PRODUCT && (
              <CustomPropertyTable<EntityType.DATA_PRODUCT>
                isRenderedInRightPanel
                entityType={EntityType.DATA_PRODUCT}
                hasEditAccess={Boolean(editCustomAttributePermission)}
                hasPermission={Boolean(viewAllPermission)}
                maxDataCap={5}
              />
            )}
          </div>
        ),
        ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
        className:
          'entity-resizable-right-panel-container domain-resizable-panel-container',
      }}
    />
  );
};

export default DocumentationTab;
