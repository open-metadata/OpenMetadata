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
import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../../assets/svg/plus-primary.svg';
import DescriptionV1 from '../../../../components/common/EntityDescription/DescriptionV1';
import { UserTeamSelectableList } from '../../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { DE_ACTIVE_COLOR } from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../../constants/ResizablePanel.constants';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../../enums/entity.enum';
import {
  DataProduct,
  TagLabel,
  TagSource,
} from '../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../generated/entity/domains/domain';
import { ChangeDescription } from '../../../../generated/entity/type';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getEntityVersionByField,
  getOwnerVersionLabel,
} from '../../../../utils/EntityVersionUtils';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import TagButton from '../../../common/TagButton/TagButton.component';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
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
  } = useGenericContext<Domain | DataProduct>();

  const {
    editDescriptionPermission,
    editOwnerPermission,
    editAllPermission,
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

  const handleUpdatedOwner = async (newOwners: Domain['owners']) => {
    const updatedData = {
      ...domain,
      owners: newOwners,
    };
    await onUpdate(updatedData as Domain | DataProduct);
  };

  return (
    <ResizablePanels
      className="domain-height-with-resizable-panel"
      firstPanel={{
        className: 'domain-resizable-panel-container',
        children: (
          <div className="p-md domain-content-container">
            <DescriptionV1
              removeBlur
              description={description}
              entityName={getEntityName(domain)}
              entityType={EntityType.DOMAIN}
              hasEditAccess={editDescriptionPermission}
              showCommentsIcon={false}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </div>
        ),
        ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
      }}
      secondPanel={{
        children: (
          <Row gutter={[0, 40]}>
            <Col data-testid="domain-owner-name" span="24">
              <div className="d-flex items-center m-b-xss">
                <Typography.Text className="right-panel-label">
                  {t('label.owner-plural')}
                </Typography.Text>
                {editOwnerPermission &&
                  domain.owners &&
                  domain.owners.length > 0 && (
                    <UserTeamSelectableList
                      hasPermission
                      multiple={{ team: false, user: true }}
                      owner={domain.owners}
                      onUpdate={(updatedUser) =>
                        handleUpdatedOwner(updatedUser)
                      }>
                      <Tooltip
                        title={t('label.edit-entity', {
                          entity: t('label.owner-plural'),
                        })}>
                        <Button
                          className="cursor-pointer flex-center m-l-xss"
                          data-testid="edit-owner"
                          icon={
                            <EditIcon color={DE_ACTIVE_COLOR} width="14px" />
                          }
                          size="small"
                          type="text"
                        />
                      </Tooltip>
                    </UserTeamSelectableList>
                  )}
              </div>

              <Space className="m-r-xss" size={4}>
                {getOwnerVersionLabel(
                  domain,
                  isVersionsView,
                  TabSpecificField.OWNERS,
                  editOwnerPermission || editAllPermission
                )}
              </Space>
              {domain.owners?.length === 0 && editOwnerPermission && (
                <UserTeamSelectableList
                  hasPermission
                  multiple={{ team: false, user: true }}
                  owner={domain.owners}
                  onUpdate={(updatedUser) => handleUpdatedOwner(updatedUser)}>
                  <TagButton
                    className="text-primary cursor-pointer"
                    icon={<PlusIcon height={16} name="plus" width={16} />}
                    label={t('label.add')}
                    tooltip=""
                  />
                </UserTeamSelectableList>
              )}
            </Col>

            <Col data-testid="domain-tags" span="24">
              <TagsContainerV2
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
            </Col>

            <Col data-testid="domain-glossary-terms" span="24">
              <TagsContainerV2
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
            </Col>

            <DomainExpertWidget />

            {type === DocumentationEntity.DOMAIN && <DomainTypeWidget />}

            {domain && type === DocumentationEntity.DATA_PRODUCT && (
              <Col data-testid="custom-properties-right-panel" span="24">
                <CustomPropertyTable<EntityType.DATA_PRODUCT>
                  isRenderedInRightPanel
                  entityType={EntityType.DATA_PRODUCT}
                  hasEditAccess={Boolean(editCustomAttributePermission)}
                  hasPermission={Boolean(viewAllPermission)}
                  maxDataCap={5}
                />
              </Col>
            )}
          </Row>
        ),
        ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
        className:
          'entity-resizable-right-panel-container domain-resizable-panel-container',
      }}
    />
  );
};

export default DocumentationTab;
