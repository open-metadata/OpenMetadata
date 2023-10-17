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
import { Button, Col, Dropdown, Row, Tabs, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, toString } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../../assets/svg/style.svg';
import { AssetSelectionModal } from '../../../components/Assets/AssetsSelectionModal/AssetSelectionModal';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
import { DomainTabs } from '../../../components/Domain/DomainPage.interface';
import DocumentationTab from '../../../components/Domain/DomainTabs/DocumentationTab/DocumentationTab.component';
import { DocumentationEntity } from '../../../components/Domain/DomainTabs/DocumentationTab/DocumentationTab.interface';
import { EntityHeader } from '../../../components/Entity/EntityHeader/EntityHeader.component';
import EntitySummaryPanel from '../../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../../components/Explore/explore.interface';
import AssetsTabs, {
  AssetsTabRef,
} from '../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import EntityDeleteModal from '../../../components/Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from '../../../components/Modals/EntityNameModal/EntityNameModal.component';
import { usePermissionProvider } from '../../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../components/PermissionProvider/PermissionProvider.interface';
import TabsLabel from '../../../components/TabsLabel/TabsLabel.component';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { myDataSearchIndex } from '../../../constants/Mydata.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  ChangeDescription,
  DataProduct,
} from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { Style } from '../../../generated/type/tagLabel';
import { searchData } from '../../../rest/miscAPI';
import { getEntityDeleteMessage } from '../../../utils/CommonUtils';
import { getQueryFilterToIncludeDomain } from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../../utils/PermissionsUtils';
import {
  getDataProductsDetailsPath,
  getDataProductVersionsPath,
  getDomainPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import StyleModal from '../../Modals/StyleModal/StyleModal.component';
import './data-products-details-page.less';
import {
  DataProductsDetailsPageProps,
  DataProductTabs,
} from './DataProductsDetailsPage.interface';

const DataProductsDetailsPage = ({
  dataProduct,
  isVersionsView = false,
  onUpdate,
  onDelete,
}: DataProductsDetailsPageProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { getEntityPermission, permissions } = usePermissionProvider();
  const {
    fqn,
    tab: activeTab,
    version,
  } = useParams<{ fqn: string; tab: string; version: string }>();
  const dataProductFqn = fqn ? decodeURIComponent(fqn) : '';
  const [dataProductPermission, setDataProductPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [assetModalVisible, setAssetModelVisible] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [assetCount, setAssetCount] = useState<number>(0);

  const breadcrumbs = useMemo(() => {
    if (!dataProduct.domain) {
      return [];
    }

    return [
      {
        name: getEntityName(dataProduct.domain),
        url: getDomainPath(dataProduct.domain.fullyQualifiedName),
        activeTitle: false,
      },
    ];
  }, [dataProduct.domain]);

  const [name, displayName] = useMemo(() => {
    const defaultName = dataProduct.name;
    const defaultDisplayName = dataProduct.displayName;

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

      return [updatedName, updatedDisplayName];
    } else {
      return [defaultName, defaultDisplayName];
    }
  }, [dataProduct, isVersionsView]);

  const {
    editDisplayNamePermission,
    editAllPermission,
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

  const fetchDataProductAssets = async () => {
    if (fqn) {
      try {
        const res = await searchData(
          '',
          1,
          0,
          `(dataProducts.fullyQualifiedName:"${fqn}")`,
          '',
          '',
          myDataSearchIndex
        );

        setAssetCount(res.data.hits.total.value ?? 0);
      } catch (error) {
        setAssetCount(0);
      }
    }
  };

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
    ...(editAllPermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.edit-entity-style-description', {
                  entity: t('label.data-product'),
                })}
                icon={<StyleIcon color={DE_ACTIVE_COLOR} width="18px" />}
                id="rename-button"
                name={t('label.style')}
              />
            ),
            key: 'edit-style-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsStyleEditing(true);
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

  const handleAssetSave = () => {
    fetchDataProductAssets();
    assetTabRef.current?.refreshAssets();
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

  const onStyleSave = (data: Style) => {
    const style: Style = {
      // if color/iconURL is empty or undefined send undefined
      color: data.color ? data.color : undefined,
      iconURL: data.iconURL ? data.iconURL : undefined,
    };
    const updatedDetails = {
      ...dataProduct,
      style,
    };

    onUpdate(updatedDetails);
    setIsStyleEditing(false);
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey === 'assets') {
      // refresh data products assets count when assets tab is selected
      fetchDataProductAssets();
    }
    if (activeKey !== activeTab) {
      history.push(getDataProductsDetailsPath(fqn, activeKey));
    }
  };

  const handleVersionClick = async () => {
    const path = isVersionsView
      ? getDataProductsDetailsPath(fqn)
      : getDataProductVersionsPath(fqn, toString(dataProduct.version));

    history.push(path);
  };

  const handleAssetClick = useCallback((asset) => {
    setPreviewAsset(asset);
  }, []);

  const tabs = useMemo(() => {
    return [
      {
        label: (
          <TabsLabel
            id={DataProductTabs.DOCUMENTATION}
            name={t('label.documentation')}
          />
        ),
        key: DataProductTabs.DOCUMENTATION,
        children: (
          <DocumentationTab
            domain={dataProduct}
            isVersionsView={isVersionsView}
            type={DocumentationEntity.DATA_PRODUCT}
            onUpdate={(data: Domain | DataProduct) =>
              onUpdate(data as DataProduct)
            }
          />
        ),
      },
      ...(!isVersionsView
        ? [
            {
              label: (
                <TabsLabel
                  count={assetCount ?? 0}
                  id={DataProductTabs.ASSETS}
                  isActive={activeTab === DataProductTabs.ASSETS}
                  name={t('label.asset-plural')}
                />
              ),
              key: DataProductTabs.ASSETS,
              children: (
                <PageLayoutV1
                  className="data-product-asset-page-layout"
                  pageTitle={t('label.domain')}
                  rightPanel={
                    previewAsset && (
                      <EntitySummaryPanel
                        entityDetails={previewAsset}
                        handleClosePanel={() => setPreviewAsset(undefined)}
                      />
                    )
                  }
                  rightPanelWidth={400}>
                  <AssetsTabs
                    assetCount={assetCount}
                    isSummaryPanelOpen={false}
                    permissions={dataProductPermission}
                    ref={assetTabRef}
                    type={AssetsOfEntity.DATA_PRODUCT}
                    onAddAsset={() => setAssetModelVisible(true)}
                    onAssetClick={handleAssetClick}
                  />
                </PageLayoutV1>
              ),
            },
          ]
        : []),
    ];
  }, [
    dataProductPermission,
    previewAsset,
    dataProduct,
    isVersionsView,
    assetCount,
    activeTab,
  ]);

  useEffect(() => {
    fetchDataProductPermission();
    fetchDataProductAssets();
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
              dataProduct.style?.iconURL ? (
                <img
                  className="align-middle"
                  data-testid="icon"
                  height={36}
                  src={dataProduct.style.iconURL}
                  width={32}
                />
              ) : (
                <DataProductIcon
                  className="align-middle"
                  color={DE_ACTIVE_COLOR}
                  height={36}
                  name="folder"
                  width={32}
                />
              )
            }
            serviceName=""
          />
        </Col>
        <Col className="p-x-md" flex="280px">
          <div style={{ textAlign: 'right' }}>
            {!isVersionsView && dataProductPermission.Create && (
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

              {!isVersionsView && manageButtonContent.length > 0 && (
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
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab ?? DomainTabs.DOCUMENTATION}
            className="domain-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
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
        queryFilter={getQueryFilterToIncludeDomain(
          dataProduct.domain?.fullyQualifiedName ?? ''
        )}
        type={AssetsOfEntity.DATA_PRODUCT}
        onCancel={() => setAssetModelVisible(false)}
        onSave={handleAssetSave}
      />

      <StyleModal
        open={isStyleEditing}
        style={dataProduct.style}
        onCancel={() => setIsStyleEditing(false)}
        onSubmit={onStyleSave}
      />
    </>
  );
};

export default DataProductsDetailsPage;
