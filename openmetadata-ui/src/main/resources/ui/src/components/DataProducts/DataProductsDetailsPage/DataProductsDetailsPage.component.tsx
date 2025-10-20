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
import { Box, useTheme } from '@mui/material';
import { Button, Dropdown, Tabs, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, toString } from 'lodash';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../../assets/svg/style.svg';
import { ROUTES } from '../../../constants/constants';
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
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityDeleteMessage } from '../../../utils/CommonUtils';
import { getDomainContainerStyles } from '../../../utils/DomainPageStyles';
import { getQueryFilterToIncludeDomain } from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import { showNotistackError } from '../../../utils/NotistackUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
} from '../../../utils/PermissionsUtils';
import {
  getDomainPath,
  getEntityDetailsPath,
  getVersionPath,
} from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import type { BreadcrumbItem } from '../../common/atoms/navigation/useBreadcrumbs';
import { useBreadcrumbs } from '../../common/atoms/navigation/useBreadcrumbs';
import { CoverImage } from '../../common/CoverImage/CoverImage.component';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import { EntityAvatar } from '../../common/EntityAvatar/EntityAvatar';
import { ManageButtonItemLabel } from '../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { AssetSelectionDrawer } from '../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer';
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
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
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
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [assetCount, setAssetCount] = useState<number>(0);

  const openAssetDrawer = useCallback(() => {
    setIsAssetDrawerOpen(true);
  }, []);

  const closeAssetDrawer = useCallback(() => {
    setIsAssetDrawerOpen(false);
  }, []);

  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [];

    // Add Data Products listing page FIRST
    items.push({
      name: t('label.data-product-plural'),
      url: ROUTES.DATA_PRODUCT,
    });

    // Add parent domain SECOND (if exists)
    if (dataProduct.domains && dataProduct.domains.length > 0) {
      items.push({
        name: getEntityName(dataProduct.domains[0]),
        url: getDomainPath(dataProduct.domains[0].fullyQualifiedName),
      });
    }

    return items;
  }, [dataProduct.domains, t]);

  const { breadcrumbs } = useBreadcrumbs({ items: breadcrumbItems });

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
        const queryFilter = getTermQuery({
          'dataProducts.fullyQualifiedName':
            dataProduct.fullyQualifiedName ?? '',
        });
        const res = await searchQuery({
          query: '',
          pageNumber: 1,
          pageSize: 0,
          queryFilter,
          searchIndex: SearchIndex.ALL,
        });

        setAssetCount(res.hits.total.value ?? 0);
      } catch (error) {
        setAssetCount(0);
        showNotistackError(
          enqueueSnackbar,
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.asset-plural-lowercase'),
          }),
          { vertical: 'top', horizontal: 'center' }
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
      showNotistackError(enqueueSnackbar, error as AxiosError, undefined, {
        vertical: 'top',
        horizontal: 'center',
      });
    }
  }, [dataProduct, enqueueSnackbar]);

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
                        onAddAsset={openAssetDrawer}
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

  const iconData = useMemo(() => {
    return (
      <EntityAvatar
        entity={{
          ...dataProduct,
          entityType: 'dataProduct',
        }}
        size={91}
        sx={{
          borderRadius: '5px',
          border: '2px solid',
          borderColor: theme.palette.allShades.white,
          marginTop: '-25px',
          marginRight: 2,
        }}
      />
    );
  }, [dataProduct, theme]);

  useEffect(() => {
    fetchDataProductPermission();
    fetchDataProductAssets();
  }, [dataProductFqn]);

  const content = (
    <>
      <Box
        className="data-product-details"
        data-testid="data-product-details"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}>
        <CoverImage
          imageUrl={
            (dataProduct.style as Style & { coverImage?: { url?: string } })
              ?.coverImage?.url
          }
          position={
            (
              dataProduct.style as Style & {
                coverImage?: { position?: string };
              }
            )?.coverImage?.position
              ? {
                  y: (
                    dataProduct.style as Style & {
                      coverImage?: { position?: string };
                    }
                  ).coverImage!.position!,
                }
              : undefined
          }
        />
        <Box sx={{ display: 'flex', mx: 5, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }}>
            <EntityHeader
              breadcrumb={[]}
              entityData={{ ...dataProduct, displayName, name }}
              entityType={EntityType.DATA_PRODUCT}
              handleFollowingClick={handleFollowingClick}
              icon={iconData}
              isFollowing={isFollowing}
              isFollowingLoading={isFollowingLoading}
              serviceName=""
              titleColor={dataProduct.style?.color}
            />
          </Box>
          <Box sx={{ width: '320px' }}>
            <Box
              sx={{
                display: 'flex',
                gap: 3,
                justifyContent: 'flex-end',
                pb: '4px',
              }}>
              {!isVersionsView && dataProductPermission.Create && (
                <Button
                  className="h-10"
                  data-testid="data-product-details-add-button"
                  type="primary"
                  onClick={openAssetDrawer}>
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
            </Box>
          </Box>
        </Box>

        <GenericProvider<DataProduct>
          muiTags
          currentVersionData={dataProduct}
          data={dataProduct}
          isVersionView={isVersionsView}
          permissions={dataProductPermission}
          type={EntityType.DATA_PRODUCT as CustomizeEntityType}
          onUpdate={onUpdate}>
          <Box
            className="data-product-details-page-tabs"
            sx={{ width: '100%' }}>
            <Box sx={{ padding: 5 }}>
              <Tabs
                destroyInactiveTabPane
                activeKey={activeTab ?? DomainTabs.DOCUMENTATION}
                className="tabs-new"
                data-testid="tabs"
                items={tabs}
                onChange={handleTabChange}
              />
            </Box>
          </Box>
        </GenericProvider>
      </Box>

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

      <AssetSelectionDrawer
        emptyPlaceHolderText={t('message.domain-does-not-have-assets', {
          name: dataProduct.domains
            ?.map((domain) => getEntityName(domain))
            .join(', '),
        })}
        entityFqn={dataProductFqn}
        open={isAssetDrawerOpen}
        queryFilter={
          getQueryFilterToIncludeDomain(
            dataProduct.domains
              ?.map((domain) => domain.fullyQualifiedName)
              .join(', ') ?? '',
            dataProduct.fullyQualifiedName ?? ''
          ) as QueryFilterInterface
        }
        type={AssetsOfEntity.DATA_PRODUCT}
        onCancel={closeAssetDrawer}
        onSave={() => {
          fetchDataProductAssets();
          assetTabRef.current?.refreshAssets();
          activeTab !== 'assets' && handleTabChange('assets');
        }}
      />

      <StyleModal
        open={isStyleEditing}
        style={dataProduct.style}
        onCancel={() => setIsStyleEditing(false)}
        onSubmit={onStyleSave}
      />
    </>
  );

  return (
    <>
      {breadcrumbs}
      <Box sx={getDomainContainerStyles(theme)}>{content}</Box>
    </>
  );
};

export default DataProductsDetailsPage;
