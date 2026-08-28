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
import { Owner } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Description from '../../../../components/common/EntityDescription/Description';
import { EntityField } from '../../../../constants/Feeds.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../../constants/ResizablePanel.constants';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/type';
import {
  DataProduct,
  TagLabel,
  TagSource,
} from '../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../generated/entity/domains/domain';
import { Operation } from '../../../../generated/entity/policies/policy';
import { ChangeDescription } from '../../../../generated/entity/type';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityVersionByField } from '../../../../utils/EntityVersionUtilsPure';
import { toOwnerRefs } from '../../../../utils/Owner/ownerConversionUtils';
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../../../utils/PermissionsUtils';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import UserTeamSelectableList from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
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
  const { t } = useTranslation();
  const resourceType =
    type === DocumentationEntity.DOMAIN
      ? ResourceEntity.DOMAIN
      : ResourceEntity.DATA_PRODUCT;
  const {
    data: domain,
    onUpdate,
    permissions,
    entityRules,
  } = useGenericContext<Domain | DataProduct>();

  const {
    editDescriptionPermission,
    editOwnerPermission,
    editCustomAttributePermission,
    editTagsPermission,
    viewCustomPropertiesPermission,
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
        viewCustomPropertiesPermission: false,
      };
    }

    return {
      editDescriptionPermission: getPrioritizedEditPermission(
        permissions,
        Operation.EditDescription
      ),
      editOwnerPermission: getPrioritizedEditPermission(
        permissions,
        Operation.EditOwners
      ),
      editAllPermission: permissions?.EditAll,
      editCustomAttributePermission: getPrioritizedEditPermission(
        permissions,
        Operation.EditCustomFields
      ),
      editTagsPermission: getPrioritizedEditPermission(
        permissions,
        Operation.EditTags
      ),
      editGlossaryTermsPermission: getPrioritizedEditPermission(
        permissions,
        Operation.EditGlossaryTerms
      ),
      viewAllPermission: permissions?.ViewAll,
      viewCustomPropertiesPermission: getPrioritizedViewPermission(
        permissions,
        Operation.ViewCustomFields
      ),
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
            <WidgetCard
              dataTestId="domain-owner-name"
              headerExtra={
                !isVersionsView && editOwnerPermission ? (
                  <UserTeamSelectableList
                    hasPermission={Boolean(editOwnerPermission)}
                    listHeight={200}
                    multiple={{
                      user: entityRules.canAddMultipleUserOwners,
                      team: entityRules.canAddMultipleTeamOwner,
                    }}
                    owner={(domain as Domain | DataProduct).owners}
                    onUpdate={async (updatedOwners?: EntityReference[]) => {
                      await onUpdate({ ...domain, owners: updatedOwners });
                    }}>
                    {isEmpty((domain as Domain | DataProduct).owners) ? (
                      <WidgetPlusButton
                        data-testid="add-owner"
                        title={t('label.add-entity', {
                          entity: t('label.owner-plural'),
                        })}
                      />
                    ) : (
                      <WidgetEditButton
                        data-testid="edit-owner"
                        title={t('label.edit-entity', {
                          entity: t('label.owner-plural'),
                        })}
                      />
                    )}
                  </UserTeamSelectableList>
                ) : null
              }
              isExpandDisabled={isEmpty(
                (domain as Domain | DataProduct).owners
              )}
              title={t('label.owner-plural')}>
              <Owner
                owners={toOwnerRefs(
                  (domain as Domain | DataProduct).owners ?? []
                )}
              />
            </WidgetCard>

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
