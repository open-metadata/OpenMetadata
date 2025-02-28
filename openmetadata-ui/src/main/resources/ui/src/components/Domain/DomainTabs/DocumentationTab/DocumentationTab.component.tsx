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
import { cloneDeep, includes, isEqual } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../../assets/svg/plus-primary.svg';
import DescriptionV1 from '../../../../components/common/EntityDescription/DescriptionV1';
import { UserSelectableList } from '../../../../components/common/UserSelectableList/UserSelectableList.component';
import { UserTeamSelectableList } from '../../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import DomainTypeSelectForm from '../../../../components/Domain/DomainTypeSelectForm/DomainTypeSelectForm.component';
import { DE_ACTIVE_COLOR } from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../../constants/ResizablePanel.constants';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../../enums/entity.enum';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import {
  Domain,
  DomainType,
} from '../../../../generated/entity/domains/domain';
import {
  ChangeDescription,
  EntityReference,
} from '../../../../generated/entity/type';
import { domainTypeTooltipDataRender } from '../../../../utils/DomainUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getEntityVersionByField,
  getOwnerVersionLabel,
} from '../../../../utils/EntityVersionUtils';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import FormItemLabel from '../../../common/Form/FormItemLabel';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import TagButton from '../../../common/TagButton/TagButton.component';
import '../../domain.less';
import {
  DocumentationEntity,
  DocumentationTabProps,
} from './DocumentationTab.interface';

const DocumentationTab = ({
  domain,
  onUpdate,
  onExtensionUpdate,
  isVersionsView = false,
  type = DocumentationEntity.DOMAIN,
  permissions,
}: DocumentationTabProps) => {
  const { t } = useTranslation();
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [editDomainType, setEditDomainType] = useState(false);
  const resourceType =
    type === DocumentationEntity.DOMAIN
      ? ResourceEntity.DOMAIN
      : ResourceEntity.DATA_PRODUCT;

  const {
    editDescriptionPermission,
    editOwnerPermission,
    editAllPermission,
    editCustomAttributePermission,
    viewAllPermission,
  } = useMemo(() => {
    if (isVersionsView) {
      return {
        editDescriptionPermission: false,
        editOwnerPermission: false,
        editAllPermission: false,
        editCustomAttributePermission: false,
      };
    }

    const editDescription = permissions?.EditDescription;

    const editOwner = permissions?.EditOwners;

    const editAll = permissions?.EditAll;

    const editCustomAttribute = permissions?.EditCustomFields;

    const viewAll = permissions?.ViewAll;

    return {
      editDescriptionPermission: editAll || editDescription,
      editOwnerPermission: editAll || editOwner,
      editAllPermission: editAll,
      editCustomAttributePermission: editAll || editCustomAttribute,
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

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (domain.description !== updatedHTML) {
      const updatedTableDetails = {
        ...domain,
        description: updatedHTML,
      };
      onUpdate(updatedTableDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const handleUpdatedOwner = async (newOwners: Domain['owners']) => {
    const updatedData = {
      ...domain,
      owners: newOwners,
    };
    await onUpdate(updatedData as Domain | DataProduct);
  };

  const handleExpertsUpdate = async (data: Array<EntityReference>) => {
    if (!isEqual(data, domain.experts)) {
      let updatedDomain = cloneDeep(domain);
      const oldExperts = data.filter((d) => includes(domain.experts, d));
      const newExperts = data
        .filter((d) => !includes(domain.experts, d))
        .map((d) => ({
          id: d.id,
          type: d.type,
          name: d.name,
          displayName: d.displayName,
        }));
      updatedDomain = {
        ...updatedDomain,
        experts: [...oldExperts, ...newExperts],
      };
      await onUpdate(updatedDomain);
    }
  };

  const handleDomainTypeUpdate = async (domainType: string) => {
    let updatedDomain = cloneDeep(domain);
    updatedDomain = {
      ...updatedDomain,
      domainType: domainType as DomainType,
    };
    await onUpdate(updatedDomain);
    setEditDomainType(false);
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
              entityFqn={domain.fullyQualifiedName}
              entityName={getEntityName(domain)}
              entityType={EntityType.DOMAIN}
              hasEditAccess={editDescriptionPermission}
              isEdit={isDescriptionEditable}
              showCommentsIcon={false}
              onCancel={() => setIsDescriptionEditable(false)}
              onDescriptionEdit={() => setIsDescriptionEditable(true)}
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
                    className="tw-text-primary cursor-pointer"
                    icon={<PlusIcon height={16} name="plus" width={16} />}
                    label={t('label.add')}
                    tooltip=""
                  />
                </UserTeamSelectableList>
              )}
            </Col>
            <Col data-testid="domain-expert-name" span="24">
              <div
                className={`d-flex items-center ${
                  domain.experts && domain.experts.length > 0 ? 'm-b-xss' : ''
                }`}>
                <Typography.Text
                  className="right-panel-label"
                  data-testid="domain-expert-heading-name">
                  {t('label.expert-plural')}
                </Typography.Text>
                {editOwnerPermission &&
                  domain.experts &&
                  domain.experts.length > 0 && (
                    <UserSelectableList
                      hasPermission
                      popoverProps={{ placement: 'topLeft' }}
                      selectedUsers={domain.experts ?? []}
                      onUpdate={handleExpertsUpdate}>
                      <Tooltip
                        title={t('label.edit-entity', {
                          entity: t('label.expert-plural'),
                        })}>
                        <Button
                          className="cursor-pointer flex-center m-l-xss"
                          data-testid="edit-expert-button"
                          icon={
                            <EditIcon color={DE_ACTIVE_COLOR} width="14px" />
                          }
                          size="small"
                          type="text"
                        />
                      </Tooltip>
                    </UserSelectableList>
                  )}
              </div>
              <div>
                {getOwnerVersionLabel(
                  domain,
                  isVersionsView ?? false,
                  TabSpecificField.EXPERTS,
                  editAllPermission
                )}
              </div>

              <div>
                {editOwnerPermission &&
                  domain.experts &&
                  domain.experts.length === 0 && (
                    <UserSelectableList
                      hasPermission={editOwnerPermission}
                      popoverProps={{ placement: 'topLeft' }}
                      selectedUsers={domain.experts ?? []}
                      onUpdate={handleExpertsUpdate}>
                      <TagButton
                        className="tw-text-primary cursor-pointer"
                        icon={<PlusIcon height={16} name="plus" width={16} />}
                        label={t('label.add')}
                        tooltip=""
                      />
                    </UserSelectableList>
                  )}
              </div>
            </Col>

            {type === DocumentationEntity.DOMAIN && (
              <Col data-testid="domainType" span="24">
                <div className="d-flex items-center m-b-xss">
                  <Typography.Text
                    className="right-panel-label"
                    data-testid="domainType-heading-name">
                    <FormItemLabel
                      align={{ targetOffset: [18, 0] }}
                      helperText={domainTypeTooltipDataRender()}
                      label={t('label.domain-type')}
                      overlayClassName="domain-type-tooltip-container"
                      placement="topLeft"
                    />
                  </Typography.Text>

                  {editAllPermission && (domain as Domain).domainType && (
                    <Tooltip
                      title={t('label.edit-entity', {
                        entity: t('label.domain-type'),
                      })}>
                      <Button
                        className="cursor-pointer flex-center m-l-xss"
                        data-testid="edit-domainType-button"
                        icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                        size="small"
                        type="text"
                        onClick={() => setEditDomainType(true)}
                      />
                    </Tooltip>
                  )}
                </div>
                {!editDomainType && (
                  <Space wrap data-testid="domain-type-label" size={6}>
                    {(domain as Domain).domainType}
                  </Space>
                )}

                {editDomainType && (
                  <DomainTypeSelectForm
                    defaultValue={(domain as Domain).domainType}
                    onCancel={() => setEditDomainType(false)}
                    onSubmit={handleDomainTypeUpdate}
                  />
                )}
              </Col>
            )}

            {domain && type === DocumentationEntity.DATA_PRODUCT && (
              <Col data-testid="custom-properties-right-panel" span="24">
                <CustomPropertyTable<EntityType.DATA_PRODUCT>
                  isRenderedInRightPanel
                  entityDetails={domain as DataProduct}
                  entityType={EntityType.DATA_PRODUCT}
                  handleExtensionUpdate={onExtensionUpdate}
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
