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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import EditIcon from '../../../assets/svg/edit-new.svg?react';
import DataProductIcon from '../../../assets/svg/ic-data-product.svg?react';
import DeleteIcon from '../../../assets/svg/ic-delete.svg?react';
import VersionIcon from '../../../assets/svg/ic-version.svg?react';
import IconDropdown from '../../../assets/svg/menu.svg?react';
import StyleIcon from '../../../assets/svg/style.svg?react';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  ChangeDescription,
  DataProduct,
} from '../../../generated/entity/domains/dataProduct';
import { Operation } from '../../../generated/entity/policies/policy';
import { Style } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { searchData } from '../../../rest/miscAPI';
import { getEntityDeleteMessage } from '../../../utils/CommonUtils';
import { getQueryFilterToIncludeDomain } from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
} from '../../../utils/PermissionsUtils';
import {
  getDomainPath,
  getEntityDetailsPath,
  getVersionPath,
} from '../../../utils/RouterUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import { ManageButtonItemLabel } from '../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { AssetSelectionModal } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal';
import { DomainTabs } from '../../Domain/DomainPage.interface';
import DocumentationTab from '../../Domain/DomainTabs/DocumentationTab/DocumentationTab.component';
import { DocumentationEntity } from '../../Domain/DomainTabs/DocumentationTab/DocumentationTab.interface';
import { EntityHeader } from '../../Entity/EntityHeader/EntityHeader.component';
import EntitySummaryPanel from '../../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import AssetsTabs, {
  AssetsTabRef,
} from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import EntityDeleteModal from '../../Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
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
  isFollowing,
  isFollowingLoading,
  handleFollowingClick,
}: DataProductsDetailsPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getEntityPermission } = usePermissionProvider();
  const { tab: activeTab, version } = useRequiredParams<{
    tab: string;
    version: string;
  }>();
  const { fqn: dataProductFqn } = useFqn();
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
    if (!dataProduct.domains) {
      return [];
    }

    return [
      {
        name: getEntityName(dataProduct.domains[0]),
        url: getDomainPath(dataProduct.domains[0].fullyQualifiedName),
        activeTitle: false,
      },
    ];
  }, [dataProduct.domains]);

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
    deleteDataProductPermission,
  } = useMemo(() => {
    if (isVersionsView) {
      return {
        editDescriptionPermission: false,
        editOwnerPermission: false,
        editAllPermission: false,
      };
    }

    return {
      editDescriptionPermission: getPrioritizedEditPermission(
        dataProductPermission,
        Operation.EditDescription
      ),
      editOwnerPermission: getPrioritizedEditPermission(
        dataProductPermission,
        Operation.EditOwners
      ),
      editAllPermission: dataProductPermission.EditAll,
      editDisplayNamePermission: getPrioritizedEditPermission(
        dataProductPermission,
        Operation.EditDisplayName
      ),
      deleteDataProductPermission: dataProductPermission.Delete,
    };
  }, [dataProductPermission, isVersionsView]);

  const fetchDataProductAssets = async () => {
    if (dataProduct) {
      try {
        const encodedFqn = getEncodedFqn(
          escapeESReservedCharacters(dataProduct.fullyQualifiedName)
        );
        const res = await searchData(
          '',
          1,
          0,
          `(dataProducts.fullyQualifiedName:"${encodedFqn}")`,
          '',
          '',
          SearchIndex.ALL
        );

        setAssetCount(res.data.hits.total.value ?? 0);
      } catch (error) {
        setAssetCount(0);
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.asset-plural-lowercase'),
          })
        );
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
                icon={EditIcon}
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
                icon={StyleIcon}
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
    ...(deleteDataProductPermission
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
                icon={DeleteIcon}
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

  const onNameSave = (obj: { name: string; displayName?: string }) => {
    if (dataProduct) {
      const { displayName } = obj;
      let updatedDetails = cloneDeep(dataProduct);

      updatedDetails = {
        ...dataProduct,
        displayName: displayName?.trim(),
      };

      onUpdate(updatedDetails);
      setIsNameEditing(false);
    }
  };

  const onStyleSave = async (data: Style) => {
    const style: Style = {
      // if color/iconURL is empty or undefined send undefined
      color: data.color ?? undefined,
      iconURL: data.iconURL ?? undefined,
    };
    const updatedDetails = {
      ...dataProduct,
      style,
    };

    await onUpdate(updatedDetails);
    setIsStyleEditing(false);
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey === 'assets') {
      // refresh data products assets count when assets tab is selected
      fetchDataProductAssets();
    }
    if (activeKey !== activeTab) {
      const path = isVersionsView
        ? getVersionPath(
            EntityType.DATA_PRODUCT,
            dataProductFqn,
            toString(dataProduct.version),
            activeKey
          )
        : getEntityDetailsPath(
            EntityType.DATA_PRODUCT,
            dataProductFqn,
            activeKey
          );

      navigate(path, {
        replace: true,
      });
    }
  };

  const handleVersionClick = async () => {
    const path = isVersionsView
      ? getEntityDetailsPath(EntityType.DATA_PRODUCT, dataProductFqn)
      : getVersionPath(
          EntityType.DATA_PRODUCT,
          dataProductFqn,
          toString(dataProduct.version)
        );

    navigate(path);
  };

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
    },
    []
  );

  const handelExtensionUpdate = useCallback(
    async (updatedDataProduct: DataProduct) => {
      await onUpdate({
        ...dataProduct,
        extension: updatedDataProduct.extension,
      });
    },
    [onUpdate, dataProduct]
  );

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
            isVersionsView={isVersionsView}
            type={DocumentationEntity.DATA_PRODUCT}
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
                <ResizablePanels
                  className="h-full domain-height-with-resizable-panel"
                  firstPanel={{
                    className: 'domain-resizable-panel-container',
                    wrapInCard: false,
                    children: (
                      <AssetsTabs
                        assetCount={assetCount}
                        entityFqn={dataProduct.fullyQualifiedName}
                        isSummaryPanelOpen={false}
                        permissions={dataProductPermission}
                        ref={assetTabRef}
                        type={AssetsOfEntity.DATA_PRODUCT}
                        onAddAsset={() => setAssetModelVisible(true)}
                        onAssetClick={handleAssetClick}
                        onRemoveAsset={handleAssetSave}
                      />
                    ),
                    minWidth: 800,
                    flex: 0.87,
                  }}
                  hideSecondPanel={!previewAsset}
                  pageTitle={t('label.domain')}
                  secondPanel={{
                    wrapInCard: false,
                    children: previewAsset && (
                      <EntitySummaryPanel
                        entityDetails={previewAsset}
                        handleClosePanel={() => setPreviewAsset(undefined)}
                      />
                    ),
                    minWidth: 400,
                    flex: 0.13,
                    className:
                      'entity-summary-resizable-right-panel-container domain-resizable-panel-container',
                  }}
                />
              ),
            },
          ]
        : []),
      {
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        key: EntityTabs.CUSTOM_PROPERTIES,
        children: (
          <CustomPropertyTable<EntityType.DATA_PRODUCT>
            entityType={EntityType.DATA_PRODUCT}
            hasEditAccess={
              getPrioritizedEditPermission(
                dataProductPermission,
                Operation.EditCustomFields
              ) && !isVersionsView
            }
            hasPermission={dataProductPermission.ViewAll}
            isVersionView={isVersionsView}
          />
        ),
      },
    ];
  }, [
    dataProductPermission,
    previewAsset,
    dataProduct,
    isVersionsView,
    handleAssetSave,
    assetCount,
    activeTab,
    handelExtensionUpdate,
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
            handleFollowingClick={handleFollowingClick}
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
            isFollowing={isFollowing}
            isFollowingLoading={isFollowingLoading}
            serviceName=""
            titleColor={dataProduct.style?.color}
          />
        </Col>
        <Col className="p-x-md" flex="320px">
          <div className="d-flex justify-end gap-3">
            {!isVersionsView && dataProductPermission.Create && (
              <Button
                className="h-10"
                data-testid="data-product-details-add-button"
                type="primary"
                onClick={() => setAssetModelVisible(true)}>
                {t('label.add-entity', {
                  entity: t('label.asset-plural'),
                })}
              </Button>
            )}

            <ButtonGroup className="spaced" size="small">
              {dataProduct?.version && (
                <Tooltip
                  title={t(
                    `label.${
                      isVersionsView
                        ? 'exit-version-history'
                        : 'version-plural-history'
                    }`
                  )}>
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
                </Tooltip>
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
                  <Tooltip
                    placement="topRight"
                    title={t('label.manage-entity', {
                      entity: t('label.data-product'),
                    })}>
                    <Button
                      className="domain-manage-dropdown-button tw-px-1.5"
                      data-testid="manage-button"
                      icon={
                        <IconDropdown className="vertical-align-inherit manage-dropdown-icon" />
                      }
                      onClick={() => setShowActions(true)}
                    />
                  </Tooltip>
                </Dropdown>
              )}
            </ButtonGroup>
          </div>
        </Col>

        <GenericProvider<DataProduct>
          currentVersionData={dataProduct}
          data={dataProduct}
          isVersionView={isVersionsView}
          permissions={dataProductPermission}
          type={EntityType.DATA_PRODUCT as CustomizeEntityType}
          onUpdate={onUpdate}>
          <Col span={24}>
            <Tabs
              destroyInactiveTabPane
              activeKey={activeTab ?? DomainTabs.DOCUMENTATION}
              className="tabs-new"
              data-testid="tabs"
              items={tabs}
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>
      </Row>

      <EntityNameModal<DataProduct>
        entity={dataProduct}
        title={t('label.edit-entity', {
          entity: t('label.display-name'),
        })}
        visible={isNameEditing}
        onCancel={() => setIsNameEditing(false)}
        onSave={onNameSave}
      />
      <EntityDeleteModal
        bodyText={getEntityDeleteMessage(dataProduct.name, '')}
        entityName={dataProduct.name}
        entityType="Glossary"
        visible={isDelete}
        onCancel={() => setIsDelete(false)}
        onConfirm={onDelete}
      />

      {assetModalVisible && (
        <AssetSelectionModal
          emptyPlaceHolderText={t('message.domain-does-not-have-assets', {
            name: dataProduct.domains
              ?.map((domain) => getEntityName(domain))
              .join(', '),
          })}
          entityFqn={dataProductFqn}
          open={assetModalVisible}
          queryFilter={
            getQueryFilterToIncludeDomain(
              dataProduct.domains
                ?.map((domain) => domain.fullyQualifiedName)
                .join(', ') ?? '',
              dataProduct.fullyQualifiedName ?? ''
            ) as QueryFilterInterface
          }
          type={AssetsOfEntity.DATA_PRODUCT}
          onCancel={() => setAssetModelVisible(false)}
          onSave={handleAssetSave}
        />
      )}

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
