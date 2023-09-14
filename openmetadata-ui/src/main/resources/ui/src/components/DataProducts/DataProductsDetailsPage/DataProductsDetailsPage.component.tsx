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
import Icon from '@ant-design/icons';
import { Button, Col, Dropdown, Row, Space, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as DomainIcon } from 'assets/svg/ic-domain.svg';
import { ReactComponent as VersionIcon } from 'assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from 'assets/svg/menu.svg';
import { ReactComponent as PlusIcon } from 'assets/svg/plus-primary.svg';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { AssetSelectionModal } from 'components/Assets/AssetsSelectionModal/AssetSelectionModal';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import { ManageButtonItemLabel } from 'components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { UserSelectableList } from 'components/common/UserSelectableList/UserSelectableList.component';
import { UserTeamSelectableList } from 'components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import DomainExperts from 'components/Domain/DomainExperts/DomainExperts.component';
import { EntityHeader } from 'components/Entity/EntityHeader/EntityHeader.component';
import AssetsTabs, {
  AssetsTabRef,
} from 'components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import {
  AssetsOfEntity,
  AssetsViewType,
} from 'components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import EntityDeleteModal from 'components/Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from 'components/Modals/EntityNameModal/EntityNameModal.component';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TagButton from 'components/TagButton/TagButton.component';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { EntityType } from 'enums/entity.enum';
import {
  ChangeDescription,
  DataProduct,
} from 'generated/entity/domains/dataProduct';
import { EntityReference, Operation } from 'generated/entity/policies/policy';
import { cloneDeep, includes, isEqual, noop, toString } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityDeleteMessage } from 'utils/CommonUtils';
import { getUserNames } from 'utils/DomainUtils';
import { getEntityName } from 'utils/EntityUtils';
import { getEntityVersionByField } from 'utils/EntityVersionUtils';
import Fqn from 'utils/Fqn.js';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from 'utils/PermissionsUtils';
import {
  getDataProductsDetailsPath,
  getDataProductVersionsPath,
  getDomainPath,
} from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';
import './data-products-details-page.less';
import { DataProductsDetailsPageProps } from './DataProductsDetailsPage.interface';
import { ReactComponent as DeleteIcon } from '/assets/svg/ic-delete.svg';

const DataProductsDetailsPage = ({
  dataProduct,
  isVersionsView = false,
  onUpdate,
  onDelete,
}: DataProductsDetailsPageProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { getEntityPermission, permissions } = usePermissionProvider();
  const { fqn, version } = useParams<{ fqn: string; version: string }>();
  const dataProductFqn = fqn ? decodeURIComponent(fqn) : '';
  const [dataProductPermission, setDataProductPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [assetModalVisible, setAssetModelVisible] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const assetTabRef = useRef<AssetsTabRef>(null);

  const breadcrumbs = useMemo(() => {
    if (!dataProductFqn) {
      return [];
    }

    const arr = Fqn.split(dataProductFqn);
    const dataFQN: Array<string> = [];

    return [
      ...arr.slice(0, -1).map((d) => {
        dataFQN.push(d);

        return {
          name: d,
          url: getDomainPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
          activeTitle: false,
        };
      }),
    ];
  }, [dataProductFqn]);

  const [name, displayName, description] = useMemo(() => {
    const defaultName = dataProduct.name;
    const defaultDisplayName = dataProduct.displayName;
    const defaultDescription = dataProduct.description;

    if (isVersionsView) {
      const updatedName = getEntityVersionByField(
        dataProduct.changeDescription as ChangeDescription,
        EntityField.NAME,
        defaultName
      );
      const updatedDisplayName = getEntityVersionByField(
        dataProduct.changeDescription as ChangeDescription,
        EntityField.DISPLAYNAME,
        defaultDisplayName
      );
      const updatedDescription = getEntityVersionByField(
        dataProduct.changeDescription as ChangeDescription,
        EntityField.DESCRIPTION,
        defaultDescription
      );

      return [updatedName, updatedDisplayName, updatedDescription];
    } else {
      return [defaultName, defaultDisplayName, defaultDescription];
    }
  }, [dataProduct, isVersionsView]);

  const {
    editDescriptionPermission,
    editOwnerPermission,
    editAllPermission,
    editDisplayNamePermission,
    deleteDataProductPermision,
  } = useMemo(() => {
    if (isVersionsView) {
      return {
        editDescriptionPermission: false,
        editOwnerPermission: false,
        editAllPermission: false,
      };
    }

    const editDescription = checkPermission(
      Operation.EditDescription,
      ResourceEntity.DATA_PRODUCT,
      permissions
    );

    const editOwner = checkPermission(
      Operation.EditOwner,
      ResourceEntity.DATA_PRODUCT,
      permissions
    );

    const editAll = checkPermission(
      Operation.EditAll,
      ResourceEntity.DATA_PRODUCT,
      permissions
    );

    const editDisplayName = checkPermission(
      Operation.EditDisplayName,
      ResourceEntity.DATA_PRODUCT,
      permissions
    );

    const deleteDataProduct = checkPermission(
      Operation.Delete,
      ResourceEntity.DATA_PRODUCT,
      permissions
    );

    return {
      editDescriptionPermission: editDescription || editAll,
      editOwnerPermission: editOwner || editAll,
      editAllPermission: editAll,
      editDisplayNamePermission: editDisplayName || editAll,
      deleteDataProductPermision: deleteDataProduct,
    };
  }, [permissions, isVersionsView]);

  const fetchDataProductPermission = useCallback(async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.DATA_PRODUCT,
        dataProduct.id
      );
      setDataProductPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [dataProduct]);

  const manageButtonContent: ItemType[] = [
    ...(editDisplayNamePermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.rename-entity', {
                  entity: t('label.data-product'),
                })}
                icon={<EditIcon color={DE_ACTIVE_COLOR} width="18px" />}
                id="rename-button"
                name={t('label.rename')}
              />
            ),
            key: 'rename-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsNameEditing(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
    ...(deleteDataProductPermision
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: t('label.data-product'),
                  }
                )}
                icon={<DeleteIcon color={DE_ACTIVE_COLOR} width="18px" />}
                id="delete-button"
                name={t('label.delete')}
              />
            ),
            key: 'delete-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsDelete(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
  ];

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (dataProduct.description !== updatedHTML) {
      const updatedTableDetails = {
        ...dataProduct,
        description: updatedHTML,
      };
      onUpdate(updatedTableDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const handleAssetSave = () => {
    assetTabRef.current?.refreshAssets();
  };

  const handleUpdatedOwner = (newOwner: DataProduct['owner']) => {
    const updatedData = {
      ...dataProduct,
      owner: newOwner,
    };
    onUpdate(updatedData as DataProduct);
  };

  const handleExpertsUpdate = (data: Array<EntityReference>) => {
    if (!isEqual(data, dataProduct.experts)) {
      let updatedDataProduct = cloneDeep(dataProduct);
      const oldExperts = data.filter((d) => includes(dataProduct.experts, d));
      const newExperts = data
        .filter((d) => !includes(dataProduct.experts, d))
        .map((d) => ({
          id: d.id,
          type: d.type,
          name: d.name,
          displayName: d.displayName,
        }));
      updatedDataProduct = {
        ...updatedDataProduct,
        experts: [...oldExperts, ...newExperts],
      };
      onUpdate(updatedDataProduct);
    }
  };

  const onNameSave = (obj: { name: string; displayName: string }) => {
    if (dataProduct) {
      const { name, displayName } = obj;
      let updatedDetails = cloneDeep(dataProduct);

      updatedDetails = {
        ...dataProduct,
        name: name?.trim() || dataProduct.name,
        displayName: displayName?.trim(),
      };

      onUpdate(updatedDetails);
      setIsNameEditing(false);
    }
  };

  const handleVersionClick = async () => {
    const path = isVersionsView
      ? getDataProductsDetailsPath(fqn)
      : getDataProductVersionsPath(fqn, toString(dataProduct.version));

    history.push(path);
  };

  useEffect(() => {
    fetchDataProductPermission();
  }, [dataProductFqn]);

  return (
    <>
      <Row
        className="data-product-details"
        data-testid="data-product-details"
        gutter={[0, 12]}>
        <Col className="p-x-md" flex="auto">
          <EntityHeader
            breadcrumb={breadcrumbs}
            entityData={{ ...dataProduct, displayName, name }}
            entityType={EntityType.DATA_PRODUCT}
            icon={
              <DomainIcon
                color={DE_ACTIVE_COLOR}
                height={36}
                name="folder"
                width={32}
              />
            }
            serviceName=""
          />
        </Col>
        <Col className="p-x-md" flex="280px">
          <div style={{ textAlign: 'right' }}>
            {!isVersionsView && (
              <Button
                data-testid="data-product-details-add-button"
                type="primary"
                onClick={() => setAssetModelVisible(true)}>
                {t('label.add-entity', {
                  entity: t('label.asset-plural'),
                })}
              </Button>
            )}

            <ButtonGroup className="p-l-xs" size="small">
              {dataProduct?.version && (
                <Button
                  className={classNames('', {
                    'text-primary border-primary': version,
                  })}
                  data-testid="version-button"
                  icon={<Icon component={VersionIcon} />}
                  onClick={handleVersionClick}>
                  <Typography.Text
                    className={classNames('', {
                      'text-primary': version,
                    })}>
                    {toString(dataProduct.version)}
                  </Typography.Text>
                </Button>
              )}

              {!isVersionsView && (
                <Dropdown
                  align={{ targetOffset: [-12, 0] }}
                  className="m-l-xs"
                  menu={{
                    items: manageButtonContent,
                  }}
                  open={showActions}
                  overlayClassName="domain-manage-dropdown-list-container"
                  overlayStyle={{ width: '350px' }}
                  placement="bottomRight"
                  trigger={['click']}
                  onOpenChange={setShowActions}>
                  <Tooltip placement="right">
                    <Button
                      className="domain-manage-dropdown-button tw-px-1.5"
                      data-testid="manage-button"
                      onClick={() => setShowActions(true)}>
                      <IconDropdown className="anticon self-center manage-dropdown-icon" />
                    </Button>
                  </Tooltip>
                </Dropdown>
              )}
            </ButtonGroup>
          </div>
        </Col>

        <Col span={24}>
          <Row className="border-top">
            <Col
              className="border-right p-md data-product-content-container"
              span={18}>
              <DescriptionV1
                description={description}
                entityName={getEntityName(dataProduct)}
                entityType={EntityType.DATA_PRODUCT}
                hasEditAccess={editDescriptionPermission}
                isEdit={isDescriptionEditable}
                showCommentsIcon={false}
                onCancel={() => setIsDescriptionEditable(false)}
                onDescriptionEdit={() => setIsDescriptionEditable(true)}
                onDescriptionUpdate={onDescriptionUpdate}
              />
              {!isVersionsView && (
                <div className="m-t-lg">
                  <AssetsTabs
                    isSummaryPanelOpen={false}
                    permissions={dataProductPermission}
                    ref={assetTabRef}
                    type={AssetsOfEntity.DATA_PRODUCT}
                    viewType={AssetsViewType.TABS}
                    onAddAsset={() => setAssetModelVisible(true)}
                    onAssetClick={noop}
                  />
                </div>
              )}
            </Col>
            <Col className="p-md" span={6}>
              <Row gutter={[0, 40]}>
                <Col data-testid="domain-owner-name" span="24">
                  <div className="d-flex items-center m-b-xss">
                    <Typography.Text className="right-panel-label">
                      {t('label.owner')}
                    </Typography.Text>
                    {editOwnerPermission && dataProduct?.owner && (
                      <UserTeamSelectableList
                        hasPermission
                        owner={dataProduct.owner}
                        onUpdate={handleUpdatedOwner}>
                        <Button
                          className="cursor-pointer flex-center m-l-xss"
                          data-testid="edit-owner"
                          icon={
                            <EditIcon color={DE_ACTIVE_COLOR} width="14px" />
                          }
                          size="small"
                          type="text"
                        />
                      </UserTeamSelectableList>
                    )}
                  </div>

                  <Space className="m-r-xss" size={4}>
                    {getUserNames(
                      dataProduct,
                      editOwnerPermission || editAllPermission,
                      isVersionsView
                    )}
                  </Space>

                  {!dataProduct?.owner && editOwnerPermission && (
                    <UserTeamSelectableList
                      hasPermission
                      owner={dataProduct.owner}
                      onUpdate={handleUpdatedOwner}>
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
                      dataProduct.experts && dataProduct.experts.length > 0
                        ? 'm-b-xss'
                        : ''
                    }`}>
                    <Typography.Text
                      className="right-panel-label"
                      data-testid="domain-expert-heading-name">
                      {t('label.expert-plural')}
                    </Typography.Text>
                    {editOwnerPermission &&
                      dataProduct.experts &&
                      dataProduct.experts.length > 0 && (
                        <UserSelectableList
                          hasPermission
                          popoverProps={{ placement: 'topLeft' }}
                          selectedUsers={dataProduct.experts ?? []}
                          onUpdate={handleExpertsUpdate}>
                          <Button
                            className="cursor-pointer flex-center m-l-xss"
                            data-testid="edit-expert-button"
                            icon={
                              <EditIcon color={DE_ACTIVE_COLOR} width="14px" />
                            }
                            size="small"
                            type="text"
                          />
                        </UserSelectableList>
                      )}
                  </div>
                  <DomainExperts
                    editPermission={editAllPermission}
                    entity={dataProduct}
                    isVersionsView={isVersionsView}
                  />
                  <div>
                    {editOwnerPermission &&
                      dataProduct.experts &&
                      dataProduct.experts.length === 0 && (
                        <UserSelectableList
                          hasPermission={editOwnerPermission}
                          popoverProps={{ placement: 'topLeft' }}
                          selectedUsers={dataProduct.experts ?? []}
                          onUpdate={handleExpertsUpdate}>
                          <TagButton
                            className="tw-text-primary cursor-pointer"
                            icon={
                              <PlusIcon height={16} name="plus" width={16} />
                            }
                            label={t('label.add')}
                            tooltip=""
                          />
                        </UserSelectableList>
                      )}
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Col>
      </Row>

      <EntityNameModal
        allowRename
        entity={dataProduct}
        title={t('label.edit-entity', {
          entity: t('label.name'),
        })}
        visible={isNameEditing}
        onCancel={() => setIsNameEditing(false)}
        onSave={onNameSave}
      />
      <EntityDeleteModal
        bodyText={getEntityDeleteMessage(dataProduct.name, '')}
        entityName={dataProduct.name}
        entityType="Glossary"
        loadingState="success"
        visible={isDelete}
        onCancel={() => setIsDelete(false)}
        onConfirm={onDelete}
      />

      <AssetSelectionModal
        entityFqn={dataProductFqn}
        open={assetModalVisible}
        type={AssetsOfEntity.DATA_PRODUCT}
        onCancel={() => setAssetModelVisible(false)}
        onSave={handleAssetSave}
      />
    </>
  );
};

export default DataProductsDetailsPage;
