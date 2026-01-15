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
import { cloneDeep, isEmpty, toLower, toString } from 'lodash';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconAnnouncementsBlack } from '../../../assets/svg/announcements-black.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../../assets/svg/style.svg';
import { ROUTES } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import {
  ChangeDescription,
  DataProduct,
} from '../../../generated/entity/domains/dataProduct';
import { Thread } from '../../../generated/entity/feed/thread';
import { Operation } from '../../../generated/entity/policies/policy';
import { PageType } from '../../../generated/system/ui/page';
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import { Style } from '../../../generated/type/tagLabel';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { getContractByEntityId } from '../../../rest/contractAPI';
import { getActiveAnnouncement } from '../../../rest/feedsAPI';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getEntityDeleteMessage,
  getFeedCounts,
} from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getDataContractStatusIcon } from '../../../utils/DataContract/DataContractUtils';
import dataProductClassBase from '../../../utils/DataProduct/DataProductClassBase';
import { getDomainContainerStyles } from '../../../utils/DomainPageStyles';
import { getQueryFilterToIncludeDomain } from '../../../utils/DomainUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityFeedLink, getEntityName } from '../../../utils/EntityUtils';
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
import { EntityAvatar } from '../../common/EntityAvatar/EntityAvatar';
import AnnouncementCard from '../../common/EntityPageInfos/AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import { ManageButtonItemLabel } from '../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { AssetSelectionDrawer } from '../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer';
import { DomainTabs } from '../../Domain/DomainPage.interface';
import { EntityHeader } from '../../Entity/EntityHeader/EntityHeader.component';
import { EntityStatusBadge } from '../../Entity/EntityStatusBadge/EntityStatusBadge.component';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import { AssetsTabRef } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import EntityDeleteModal from '../../Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
import StyleModal from '../../Modals/StyleModal/StyleModal.component';
import './data-products-details-page.less';
import { DataProductsDetailsPageProps } from './DataProductsDetailsPage.interface';

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
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const { customizedPage, isLoading: isCustomPageLoading } = useCustomPages(
    PageType.DataProduct
  );
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [assetCount, setAssetCount] = useState<number>(0);
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [isAnnouncementDrawerOpen, setIsAnnouncementDrawerOpen] =
    useState<boolean>(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Thread>();
  const [dataContract, setDataContract] = useState<DataContract>();

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.DATA_PRODUCT,
      dataProduct.fullyQualifiedName ?? '',
      handleFeedCount
    );
  };

  const openAssetDrawer = useCallback(() => {
    setIsAssetDrawerOpen(true);
  }, []);

  const closeAssetDrawer = useCallback(() => {
    setIsAssetDrawerOpen(false);
  }, []);

  const fetchActiveAnnouncement = async () => {
    try {
      const announcements = await getActiveAnnouncement(
        getEntityFeedLink(
          EntityType.DATA_PRODUCT,
          dataProduct.fullyQualifiedName ?? ''
        )
      );
      if (isEmpty(announcements.data)) {
        setActiveAnnouncement(undefined);
      } else {
        setActiveAnnouncement(announcements.data[0]);
      }
    } catch (error) {
      showNotistackError(enqueueSnackbar, error as AxiosError, undefined, {
        vertical: 'top',
        horizontal: 'center',
      });
    }
  };

  const fetchDataProductContract = async () => {
    try {
      const contract = await getContractByEntityId(
        dataProduct.id,
        EntityType.DATA_PRODUCT,
        [TabSpecificField.OWNERS]
      );
      setDataContract(contract);
    } catch {
      setDataContract(undefined);
    }
  };

  const handleOpenAnnouncementDrawer = () => {
    setIsAnnouncementDrawerOpen(true);
  };

  const handleCloseAnnouncementDrawer = () => {
    setIsAnnouncementDrawerOpen(false);
    fetchActiveAnnouncement();
  };

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
    ...(editAllPermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.announcement-action-description')}
                icon={IconAnnouncementsBlack}
                id="announcement-button"
                name={t('label.announcement-plural')}
              />
            ),
            key: 'announcement-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              handleOpenAnnouncementDrawer();
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
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

  const onNameSave = async (obj: { name: string; displayName?: string }) => {
    if (dataProduct) {
      const { name, displayName } = obj;
      let updatedDetails = cloneDeep(dataProduct);

      updatedDetails = {
        ...dataProduct,
        displayName: displayName?.trim(),
        name: name?.trim(),
      };

      try {
        await onUpdate(updatedDetails);

        // If name changed, navigate to the new URL
        if (name && name.trim() !== dataProduct.name) {
          navigate(
            getEntityDetailsPath(
              EntityType.DATA_PRODUCT,
              name.trim(),
              activeTab
            ),
            { replace: true }
          );
        }
      } catch (error) {
        // Error is already handled by the parent component
      } finally {
        setIsNameEditing(false);
      }
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

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = dataProductClassBase.getDataProductDetailPageTabs({
      dataProduct,
      isVersionsView,
      dataProductPermission,
      assetCount,
      activeTab: activeTab as EntityTabs,
      assetTabRef,
      previewAsset,
      setPreviewAsset,
      setAssetModalVisible: openAssetDrawer,
      handleAssetClick,
      handleAssetSave,
      feedCount,
      getEntityFeedCount,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.DOCUMENTATION
    );
  }, [
    customizedPage?.tabs,
    dataProduct,
    dataProductPermission,
    previewAsset,
    handleAssetClick,
    handleAssetSave,
    assetCount,
    activeTab,
    feedCount,
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
    getEntityFeedCount();
    fetchActiveAnnouncement();
    fetchDataProductContract();
  }, [dataProductFqn]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () =>
      checkIfExpandViewSupported(
        tabs[0],
        activeTab as EntityTabs,
        PageType.DataProduct
      ),
    [tabs[0], activeTab]
  );

  const dataContractLatestResultButton = useMemo(() => {
    if (
      dataContract?.latestResult?.status &&
      [
        ContractExecutionStatus.Aborted,
        ContractExecutionStatus.Failed,
        ContractExecutionStatus.Running,
      ].includes(dataContract.latestResult.status)
    ) {
      const icon = getDataContractStatusIcon(dataContract.latestResult.status);

      return (
        <Button
          className={classNames(
            'data-contract-latest-result-button',
            toLower(dataContract.latestResult.status)
          )}
          data-testid="data-contract-latest-result-btn"
          icon={icon ? <Icon component={icon} /> : null}
          onClick={() => {
            handleTabChange(EntityTabs.CONTRACT);
          }}>
          {t(`label.entity-${toLower(dataContract.latestResult.status)}`, {
            entity: t('label.contract'),
          })}
        </Button>
      );
    }

    return null;
  }, [dataContract]);

  const statusBadge = useMemo(() => {
    const shouldShowStatus = entityUtilClassBase.shouldShowEntityStatus(
      EntityType.DATA_PRODUCT
    );
    const entityStatus =
      'entityStatus' in dataProduct
        ? dataProduct.entityStatus
        : EntityStatus.Unprocessed;

    return shouldShowStatus && entityStatus ? (
      <EntityStatusBadge showDivider={false} status={entityStatus} />
    ) : null;
  }, [dataProduct]);

  if (isCustomPageLoading) {
    return <Loader />;
  }

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
                  y:
                    (
                      dataProduct.style as Style & {
                        coverImage?: { position?: string };
                      }
                    )?.coverImage?.position ?? '',
                }
              : undefined
          }
        />
        <Box sx={{ display: 'flex', mx: 5, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }}>
            <EntityHeader
              badge={statusBadge}
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
          <Box>
            <Box
              sx={{
                display: 'flex',
                gap: 3,
                justifyContent: 'flex-end',
                alignItems: 'center',
                pb: '4px',
              }}>
              {!isVersionsView && dataProductPermission.Create && (
                <Button
                  data-testid="data-product-details-add-button"
                  type="primary"
                  onClick={openAssetDrawer}>
                  {t('label.add-entity', {
                    entity: t('label.asset-plural'),
                  })}
                </Button>
              )}

              <ButtonGroup className="spaced" size="small">
                {dataContractLatestResultButton}

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

              {activeAnnouncement && (
                <AnnouncementCard
                  announcement={activeAnnouncement}
                  onClick={handleOpenAnnouncementDrawer}
                />
              )}
            </Box>
          </Box>
        </Box>

        <GenericProvider<DataProduct>
          muiTags
          currentVersionData={dataProduct}
          customizedPage={customizedPage}
          data={dataProduct}
          isTabExpanded={isTabExpanded}
          isVersionView={isVersionsView}
          permissions={dataProductPermission}
          type={EntityType.DATA_PRODUCT}
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
                tabBarExtraContent={
                  isExpandViewSupported && (
                    <AlignRightIconButton
                      className={isTabExpanded ? 'rotate-180' : ''}
                      title={
                        isTabExpanded ? t('label.collapse') : t('label.expand')
                      }
                      onClick={toggleTabExpanded}
                    />
                  )
                }
                onChange={handleTabChange}
              />
            </Box>
          </Box>
        </GenericProvider>
      </Box>

      <EntityNameModal<DataProduct>
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

      <AnnouncementDrawer
        showToastInSnackbar
        createPermission={editAllPermission}
        entityFQN={dataProduct.fullyQualifiedName ?? ''}
        entityType={EntityType.DATA_PRODUCT}
        open={isAnnouncementDrawerOpen}
        onClose={handleCloseAnnouncementDrawer}
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
