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
import Description from '../../../../components/common/EntityDescription/Description';
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
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityVersionByField } from '../../../../utils/EntityVersionUtilsPure';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
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

  // Named-flag derivation (Task 8 prop-contract migration): `permissions` here is the raw
  // OperationPermission read off useGenericContext(), sourced from whichever owner rendered
  // this tab (DomainDetails.component.tsx or DataProductsDetailsPage.component.tsx — same
  // batch). No `deleted` argument: neither Domain nor DataProduct carries a `deleted` field
  // (confirmed against their generated types), and the old derivation never referenced one
  // either, so getDerivedPermissionFlags defaults to its `deleted = false` — nothing to gate.
  // Every flag below is a pure rename of an already-prioritized call
  // (getPrioritizedEditPermission/getPrioritizedViewPermission → the named flag that encodes
  // the identical computation) — not a raw-to-prioritized semantic change, so none of these
  // need the canViewTests-style citation.
  const flags = useMemo(
    () => getDerivedPermissionFlags(permissions),
    [permissions]
  );

  const {
    editDescriptionPermission,
    editCustomAttributePermission,
    editTagsPermission,
    viewCustomPropertiesPermission,
    editGlossaryTermsPermission,
  } = useMemo(() => {
    if (isVersionsView) {
      return {
        editDescriptionPermission: false,
        editCustomAttributePermission: false,
        editTagsPermission: false,
        editGlossaryTermsPermission: false,
        viewCustomPropertiesPermission: false,
      };
    }

    return {
      editDescriptionPermission: flags.canEditDescription,
      editCustomAttributePermission: flags.canEditCustomFields,
      editTagsPermission: flags.canEditTags,
      editGlossaryTermsPermission: flags.canEditGlossaryTerms,
      viewCustomPropertiesPermission: flags.canViewCustomFields,
    };
  }, [flags, isVersionsView]);

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
      className="h-full domain-height-with-resizable-panel no-right-panel-splitter"
      firstPanel={{
        className:
          'domain-resizable-panel-container left-panel-documentation-tab',
        children: (
          <Description
            removeBlur
            wrapInCard
            description={description}
            entityName={getEntityName(domain)}
            entityType={
              type === DocumentationEntity.DOMAIN
                ? EntityType.DOMAIN
                : EntityType.DATA_PRODUCT
            }
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
              entityType={resourceType}
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
              entityType={resourceType}
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
                hasPermission={Boolean(viewCustomPropertiesPermission)}
                maxDataCap={5}
              />
            )}
          </div>
        ),
        ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
        className:
          'entity-resizable-right-panel-container domain-resizable-panel-container right-panel-documentation-tab',
      }}
    />
  );
};

export default DocumentationTab;
