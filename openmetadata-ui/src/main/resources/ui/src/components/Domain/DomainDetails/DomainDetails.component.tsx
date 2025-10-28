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
import Icon, { DownOutlined } from '@ant-design/icons';
import { Box, Typography as MuiTypography, useTheme } from '@mui/material';
import { Button, Dropdown, Form, Space, Tabs, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, isEmpty, isEqual, toString } from 'lodash';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../../assets/svg/style.svg';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { EntityHeader } from '../../../components/Entity/EntityHeader/EntityHeader.component';
import { AssetsTabRef } from '../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import EntityNameModal from '../../../components/Modals/EntityNameModal/EntityNameModal.component';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { ChangeDescription } from '../../../generated/entity/type';
import { PageType } from '../../../generated/system/ui/page';
import { Style } from '../../../generated/type/tagLabel';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import {
  addDataProducts,
  patchDataProduct,
} from '../../../rest/dataProductAPI';
import { addDomains, patchDomains } from '../../../rest/domainAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getFeedCounts, getIsErrorMatch } from '../../../utils/CommonUtils';
import { createEntityWithCoverImage } from '../../../utils/CoverImageUploadUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import domainClassBase from '../../../utils/Domain/DomainClassBase';
import { getDomainContainerStyles } from '../../../utils/DomainPageStyles';
import {
  getQueryFilterForDomain,
  getQueryFilterToExcludeDomainTerms,
} from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import Fqn from '../../../utils/Fqn';
import { showNotistackError } from '../../../utils/NotistackUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
} from '../../../utils/PermissionsUtils';
import {
  getDomainDetailsPath,
  getDomainPath,
  getDomainVersionsPath,
} from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { useFormDrawerWithRef } from '../../common/atoms/drawer';
import type { BreadcrumbItem } from '../../common/atoms/navigation/useBreadcrumbs';
import { useBreadcrumbs } from '../../common/atoms/navigation/useBreadcrumbs';
import { CoverImage } from '../../common/CoverImage/CoverImage.component';
import DeleteWidgetModal from '../../common/DeleteWidget/DeleteWidgetModal';
import { EntityAvatar } from '../../common/EntityAvatar/EntityAvatar';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { AssetSelectionDrawer } from '../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import StyleModal from '../../Modals/StyleModal/StyleModal.component';
import AddDomainForm from '../AddDomainForm/AddDomainForm.component';
import '../domain.less';
import { DomainFormType } from '../DomainPage.interface';
import { DataProductsTabRef } from '../DomainTabs/DataProductsTab/DataProductsTab.interface';
import { DomainDetailsProps } from './DomainDetails.interface';

const DomainDetails = ({
  domain,
  onUpdate,
  onDelete,
  isVersionsView = false,
  isFollowing,
  isFollowingLoading,
  handleFollowingClick,
}: DomainDetailsProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { getEntityPermission, permissions } = usePermissionProvider();
  const navigate = useNavigate();
  const { tab: activeTab, version } = useRequiredParams<{
    tab: EntityTabs;
    version: string;
  }>();
  const { fqn: domainFqn } = useFqn();
  const { currentUser } = useApplicationStore();

  const assetTabRef = useRef<AssetsTabRef>(null);
  const dataProductsTabRef = useRef<DataProductsTabRef>(null);
  const [domainPermission, setDomainPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  // Sub-domain drawer implementation
  const [subDomainForm] = Form.useForm();
  const [isSubDomainLoading, setIsSubDomainLoading] = useState(false);

  // Data product drawer implementation
  const [dataProductForm] = Form.useForm();
  const [isDataProductLoading, setIsDataProductLoading] = useState(false);

  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [assetCount, setAssetCount] = useState<number>(0);
  const [dataProductsCount, setDataProductsCount] = useState<number>(0);
  const [subDomainsCount, setSubDomainsCount] = useState<number>(0);
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const encodedFqn = getEncodedFqn(
    escapeESReservedCharacters(domain.fullyQualifiedName)
  );
  const { customizedPage, isLoading } = useCustomPages(PageType.Domain);
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const isSubDomain = useMemo(() => !isEmpty(domain.parent), [domain]);

  const queryFilter = useMemo(() => {
    return getQueryFilterForDomain(domainFqn);
  }, [domainFqn]);

  const isOwner = useMemo(
    () => domain.owners?.some((owner) => isEqual(owner.id, currentUser?.id)),
    [domain, currentUser]
  );

  const fetchDomainAssets = async () => {
    if (domainFqn && !isVersionsView) {
      try {
        const res = await searchQuery({
          query: '',
          pageNumber: 0,
          pageSize: 0,
          queryFilter,
          searchIndex: SearchIndex.ALL,
          filters: '',
        });

        const totalCount = res?.hits?.total.value ?? 0;
        setAssetCount(totalCount);
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

  const handleTabChange = (activeKey: string) => {
    if (activeKey === 'assets') {
      fetchDomainAssets();
    }
    if (activeKey !== activeTab) {
      navigate(getDomainDetailsPath(domainFqn, activeKey));
    }
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.DOMAIN,
      domain.fullyQualifiedName ?? '',
      handleFeedCount
    );
  };

  const {
    formDrawer: dataProductDrawer,
    openDrawer: openDataProductDrawer,
    closeDrawer: closeDataProductDrawer,
  } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.data-product') }),
    anchor: 'right',
    width: 670,
    closeOnEscape: false,
    onCancel: () => {
      dataProductForm.resetFields();
    },
    form: (
      <AddDomainForm
        isFormInDialog
        formRef={dataProductForm}
        loading={isDataProductLoading}
        parentDomain={domain}
        type={DomainFormType.DATA_PRODUCT}
        onCancel={() => {
          // No-op: Drawer close and form reset handled by useFormDrawerWithRef
        }}
        onSubmit={async (formData: CreateDomain | CreateDataProduct) => {
          setIsDataProductLoading(true);
          try {
            (formData as CreateDataProduct).domains = [
              domain.fullyQualifiedName ?? '',
            ];

            await createEntityWithCoverImage({
              formData: formData as CreateDataProduct,
              entityType: EntityType.DATA_PRODUCT,
              entityLabel: t('label.data-product'),
              entityPluralLabel: 'data-products',
              createEntity: addDataProducts,
              patchEntity: patchDataProduct,
              onSuccess: () => {
                fetchDataProducts();
                handleTabChange(EntityTabs.DATA_PRODUCTS);
                onUpdate?.(domain);
                closeDataProductDrawer();
              },
              enqueueSnackbar,
              closeSnackbar,
              t,
            });
          } finally {
            setIsDataProductLoading(false);
          }
        }}
      />
    ),
    formRef: dataProductForm,
    onSubmit: () => {
      // This is called by the drawer button, but actual submission
      // happens via formRef.submit() which triggers form.onFinish
    },
    loading: isDataProductLoading,
  });

  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    if (!domainFqn) {
      return [{ name: t('label.domain-plural'), url: getDomainPath() }];
    }

    const arr = Fqn.split(domainFqn);
    const dataFQN: Array<string> = [];

    return [
      {
        name: t('label.domain-plural'),
        url: getDomainPath(),
      },
      ...arr.map((d) => {
        dataFQN.push(d);

        return {
          name: d,
          url: getDomainPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
        };
      }),
    ];
  }, [domainFqn, t]);

  const { breadcrumbs } = useBreadcrumbs({ items: breadcrumbItems });

  // Asset selection drawer state
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);

  const openAssetDrawer = useCallback(() => {
    setIsAssetDrawerOpen(true);
  }, []);

  const closeAssetDrawer = useCallback(() => {
    setIsAssetDrawerOpen(false);
  }, []);

  const [name, displayName] = useMemo(() => {
    if (isVersionsView) {
      const updatedName = getEntityVersionByField(
        domain.changeDescription as ChangeDescription,
        EntityField.NAME,
        domain.name
      );
      const updatedDisplayName = getEntityVersionByField(
        domain.changeDescription as ChangeDescription,
        EntityField.DISPLAYNAME,
        domain.displayName
      );

      return [updatedName, updatedDisplayName];
    } else {
      return [domain.name, domain.displayName];
    }
  }, [domain, isVersionsView]);

  const {
    formDrawer: subDomainDrawer,
    openDrawer: openSubDomainDrawer,
    closeDrawer: closeSubDomainDrawer,
  } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.sub-domain') }),
    anchor: 'right',
    width: 670,
    closeOnEscape: false,
    onCancel: () => {
      subDomainForm.resetFields();
    },
    form: (
      <AddDomainForm
        isFormInDialog
        formRef={subDomainForm}
        loading={isSubDomainLoading}
        type={DomainFormType.SUBDOMAIN}
        onCancel={() => {
          // No-op: Drawer close and form reset handled by useFormDrawerWithRef
        }}
        onSubmit={async (formData: CreateDomain | CreateDataProduct) => {
          setIsSubDomainLoading(true);
          try {
            (formData as CreateDomain).parent = domain.fullyQualifiedName;

            await createEntityWithCoverImage({
              formData: formData as CreateDomain,
              entityType: EntityType.DOMAIN,
              entityLabel: t('label.sub-domain'),
              entityPluralLabel: 'sub-domains',
              createEntity: addDomains,
              patchEntity: patchDomains,
              onSuccess: () => {
                fetchSubDomainsCount();
                handleTabChange(EntityTabs.SUBDOMAINS);
                closeSubDomainDrawer();
              },
              enqueueSnackbar,
              closeSnackbar,
              t,
            });
          } finally {
            setIsSubDomainLoading(false);
          }
        }}
      />
    ),
    formRef: subDomainForm,
    onSubmit: () => {
      // This is called by the drawer button, but actual submission
      // happens via formRef.submit() which triggers form.onFinish
    },
    loading: isSubDomainLoading,
  });

  const editDisplayNamePermission = useMemo(() => {
    return getPrioritizedEditPermission(
      domainPermission,
      Operation.EditDisplayName
    );
  }, [domainPermission]);

  const addButtonContent = [
    ...(domainPermission.Create
      ? [
          {
            label: t('label.asset-plural'),
            key: '1',
            onClick: openAssetDrawer,
          },
          {
            label: t('label.sub-domain-plural'),
            key: '2',
            onClick: openSubDomainDrawer,
          },
        ]
      : []),
    ...(isOwner || permissions.dataProduct.Create
      ? [
          {
            label: t('label.data-product-plural'),
            key: '3',
            onClick: openDataProductDrawer,
          },
        ]
      : []),
  ];

  const fetchSubDomainsCount = useCallback(async () => {
    if (!isVersionsView) {
      try {
        const res = await searchQuery({
          query: '',
          pageNumber: 1,
          pageSize: 0,
          queryFilter: getTermQuery({
            'parent.fullyQualifiedName.keyword':
              domain.fullyQualifiedName ?? '',
          }),
          searchIndex: SearchIndex.DOMAIN,
          trackTotalHits: true,
        });

        const totalCount = res.hits.total.value ?? 0;
        setSubDomainsCount(totalCount);
      } catch (error) {
        setSubDomainsCount(0);
        showNotistackError(
          enqueueSnackbar,
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.sub-domain-lowercase'),
          }),
          { vertical: 'top', horizontal: 'center' }
        );
      }
    }
  }, [isVersionsView, encodedFqn]);

  const addSubDomain = useCallback(
    async (formData: CreateDomain) => {
      const data = {
        ...formData,
        parent: domain.fullyQualifiedName,
      };

      try {
        await addDomains(data as CreateDomain);
        fetchSubDomainsCount();
      } catch (error) {
        showNotistackError(
          enqueueSnackbar,
          getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist) ? (
            <MuiTypography sx={{ fontWeight: 600 }} variant="body2">
              {t('server.entity-already-exist', {
                entity: t('label.sub-domain'),
                entityPlural: t('label.sub-domain-lowercase-plural'),
                name: data.name,
              })}
            </MuiTypography>
          ) : (
            (error as AxiosError)
          ),
          t('server.add-entity-error', {
            entity: t('label.sub-domain-lowercase'),
          }),
          { vertical: 'top', horizontal: 'center' }
        );

        throw error; // Re-throw to reject the promise
      } finally {
        closeSubDomainDrawer();
      }
    },
    [domain, fetchSubDomainsCount]
  );

  const handleVersionClick = async () => {
    const path = isVersionsView
      ? getDomainPath(domainFqn)
      : getDomainVersionsPath(domainFqn, toString(domain.version));

    navigate(path);
  };

  const fetchDataProducts = async () => {
    if (!isVersionsView) {
      try {
        const res = await searchQuery({
          query: '',
          pageNumber: 1,
          pageSize: 0,
          queryFilter: getTermQuery({
            'domains.fullyQualifiedName': domain.fullyQualifiedName ?? '',
          }),
          searchIndex: SearchIndex.DATA_PRODUCT,
        });

        setDataProductsCount(res.hits.total.value ?? 0);
      } catch (error) {
        setDataProductsCount(0);
        showNotistackError(
          enqueueSnackbar,
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.data-product-lowercase'),
          }),
          { vertical: 'top', horizontal: 'center' }
        );
      }
    }
  };

  const fetchDomainPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.DOMAIN,
        domain.id
      );
      setDomainPermission(response);
    } catch (error) {
      showNotistackError(enqueueSnackbar, error as AxiosError, undefined, {
        vertical: 'top',
        horizontal: 'center',
      });
    }
  };

  const onAddDataProduct = useCallback(() => {
    openDataProductDrawer();
  }, [openDataProductDrawer]);

  const onNameSave = (obj: { name: string; displayName?: string }) => {
    const { displayName } = obj;
    let updatedDetails = cloneDeep(domain);

    updatedDetails = {
      ...domain,
      displayName: displayName?.trim(),
    };

    onUpdate(updatedDetails);
    setIsNameEditing(false);
  };

  const onStyleSave = async (data: Style) => {
    const style: Style = {
      // if color/iconURL is empty or undefined send undefined
      color: data.color ?? undefined,
      iconURL: data.iconURL ?? undefined,
    };
    const updatedDetails = {
      ...domain,
      style,
    };

    await onUpdate(updatedDetails);
    setIsStyleEditing(false);
  };

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
    },
    []
  );

  const manageButtonContent: ItemType[] = [
    ...(editDisplayNamePermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.rename-entity', {
                  entity: t('label.domain'),
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
    ...(domainPermission?.EditAll
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.edit-entity-style-description', {
                  entity: t('label.domain'),
                })}
                icon={StyleIcon}
                id="edit-style-button"
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
    ...(domainPermission.Delete
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: t('label.domain'),
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

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = domainClassBase.getDomainDetailPageTabs({
      domain,
      isVersionsView,
      domainPermission,
      subDomainsCount,
      dataProductsCount,
      assetCount,
      activeTab,
      onAddDataProduct,
      queryFilter,
      assetTabRef,
      dataProductsTabRef,
      previewAsset,
      setPreviewAsset,
      setAssetModalVisible: openAssetDrawer,
      handleAssetClick,
      handleAssetSave: () => {
        fetchDomainAssets();
        assetTabRef.current?.refreshAssets();
        activeTab !== 'assets' && handleTabChange('assets');
      },
      setShowAddSubDomainModal: openSubDomainDrawer,
      onAddSubDomain: addSubDomain,
      showAddSubDomainModal: false,
      labelMap: tabLabelMap,
      feedCount,
      onFeedUpdate: getEntityFeedCount,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.DOCUMENTATION
    );
  }, [
    domain,
    domainPermission,
    previewAsset,
    handleAssetClick,
    assetCount,
    dataProductsCount,
    activeTab,
    subDomainsCount,
    queryFilter,
    customizedPage?.tabs,
    feedCount,
    openAssetDrawer,
    fetchDomainAssets,
    handleTabChange,
  ]);

  useEffect(() => {
    fetchDomainPermission();
    fetchDomainAssets();
    fetchDataProducts();
    getEntityFeedCount();
  }, [domain.fullyQualifiedName]);

  useEffect(() => {
    fetchSubDomainsCount();
  }, [domainFqn, fetchSubDomainsCount]);

  const iconData = useMemo(() => {
    return (
      <EntityAvatar
        entity={{
          ...domain,
          entityType: 'domain',
          parent: isSubDomain ? { type: 'domain' } : undefined,
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
  }, [domain, isSubDomain, theme]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Domain),
    [tabs[0], activeTab]
  );
  if (isLoading) {
    return <Loader />;
  }

  const content = (
    <>
      <Box
        className="domain-details"
        data-testid="domain-details"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}>
        <CoverImage
          imageUrl={
            (domain.style as Style & { coverImage?: { url?: string } })
              ?.coverImage?.url
          }
          position={
            (domain.style as Style & { coverImage?: { position?: string } })
              ?.coverImage?.position
              ? {
                  y: (
                    domain.style as Style & {
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
              entityData={{ ...domain, displayName, name }}
              entityType={EntityType.DOMAIN}
              handleFollowingClick={handleFollowingClick}
              icon={iconData}
              isFollowing={isFollowing}
              isFollowingLoading={isFollowingLoading}
              serviceName=""
              titleColor={domain.style?.color}
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
              {!isVersionsView && addButtonContent.length > 0 && (
                <Dropdown
                  className="m-l-xs h-10"
                  data-testid="domain-details-add-button-menu"
                  menu={{
                    items: addButtonContent,
                  }}
                  placement="bottomRight"
                  trigger={['click']}>
                  <Button
                    data-testid="domain-details-add-button"
                    type="primary">
                    <Space>
                      {t('label.add')}
                      <DownOutlined />
                    </Space>
                  </Button>
                </Dropdown>
              )}

              <ButtonGroup className="spaced" size="small">
                {domain?.version && (
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
                        {toString(domain.version)}
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
                        entity: t('label.domain'),
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

        <GenericProvider<Domain>
          muiTags
          customizedPage={customizedPage}
          data={domain}
          isTabExpanded={isTabExpanded}
          isVersionView={isVersionsView}
          permissions={domainPermission}
          type={EntityType.DOMAIN}
          onUpdate={onUpdate}>
          <Box className="domain-details-page-tabs" sx={{ width: '100%' }}>
            <Box sx={{ padding: 5 }}>
              <Tabs
                destroyInactiveTabPane
                activeKey={activeTab}
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

      {dataProductDrawer}
      <AssetSelectionDrawer
        entityFqn={domainFqn}
        open={isAssetDrawerOpen}
        queryFilter={getQueryFilterToExcludeDomainTerms(domainFqn)}
        type={AssetsOfEntity.DOMAIN}
        onCancel={closeAssetDrawer}
        onSave={() => {
          fetchDomainAssets();
          assetTabRef.current?.refreshAssets();
          activeTab !== 'assets' && handleTabChange('assets');
        }}
      />

      {domain && (
        <DeleteWidgetModal
          afterDeleteAction={() => onDelete(domain.id)}
          allowSoftDelete={false}
          entityId={domain.id}
          entityName={getEntityName(domain)}
          entityType={EntityType.DOMAIN}
          visible={isDelete}
          onCancel={() => {
            setIsDelete(false);
          }}
        />
      )}
      <EntityNameModal<Domain>
        entity={domain}
        title={t('label.edit-entity', {
          entity: t('label.display-name'),
        })}
        visible={isNameEditing}
        onCancel={() => setIsNameEditing(false)}
        onSave={onNameSave}
      />
      <StyleModal
        open={isStyleEditing}
        style={domain.style}
        onCancel={() => setIsStyleEditing(false)}
        onSubmit={onStyleSave}
      />
      {subDomainDrawer}
    </>
  );

  return (
    <>
      {breadcrumbs}
      <Box sx={getDomainContainerStyles(theme)}>{content}</Box>
    </>
  );
};

export default withActivityFeed(DomainDetails);
