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
import {
  Button,
  Col,
  Dropdown,
  Modal,
  Row,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { useForm } from 'antd/lib/form/Form';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, isEmpty, isEqual, toString } from 'lodash';
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
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as SubDomainIcon } from '../../../assets/svg/ic-subdomain.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../../assets/svg/style.svg';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { EntityHeader } from '../../../components/Entity/EntityHeader/EntityHeader.component';
import EntitySummaryPanel from '../../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import AssetsTabs, {
  AssetsTabRef,
} from '../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import EntityNameModal from '../../../components/Modals/EntityNameModal/EntityNameModal.component';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import {
  DE_ACTIVE_COLOR,
  ERROR_MESSAGE,
  getEntityDetailsPath,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { ChangeDescription } from '../../../generated/entity/type';
import { Style } from '../../../generated/type/tagLabel';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { addDataProducts } from '../../../rest/dataProductAPI';
import { addDomains } from '../../../rest/domainAPI';
import { searchData } from '../../../rest/miscAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { formatDomainsResponse } from '../../../utils/APIUtils';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
import {
  getQueryFilterForDomain,
  getQueryFilterToExcludeDomainTerms,
} from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import Fqn from '../../../utils/Fqn';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  getDomainDetailsPath,
  getDomainPath,
  getDomainVersionsPath,
} from '../../../utils/RouterUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DeleteWidgetModal from '../../common/DeleteWidget/DeleteWidgetModal';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { AssetSelectionModal } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import StyleModal from '../../Modals/StyleModal/StyleModal.component';
import AddDomainForm from '../AddDomainForm/AddDomainForm.component';
import AddSubDomainModal from '../AddSubDomainModal/AddSubDomainModal.component';
import '../domain.less';
import { DomainFormType, DomainTabs } from '../DomainPage.interface';
import DataProductsTab from '../DomainTabs/DataProductsTab/DataProductsTab.component';
import { DataProductsTabRef } from '../DomainTabs/DataProductsTab/DataProductsTab.interface';
import DocumentationTab from '../DomainTabs/DocumentationTab/DocumentationTab.component';
import SubDomainsTable from '../SubDomainsTable/SubDomainsTable.component';
import { DomainDetailsPageProps } from './DomainDetailsPage.interface';

const DomainDetailsPage = ({
  domain,
  onUpdate,
  onDelete,
  isVersionsView = false,
}: DomainDetailsPageProps) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const { getEntityPermission, permissions } = usePermissionProvider();
  const history = useHistory();
  const { tab: activeTab, version } =
    useParams<{ tab: string; version: string }>();
  const { fqn: domainFqn } = useFqn();
  const { currentUser } = useApplicationStore();

  const assetTabRef = useRef<AssetsTabRef>(null);
  const dataProductsTabRef = useRef<DataProductsTabRef>(null);
  const [domainPermission, setDomainPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [showAddDataProductModal, setShowAddDataProductModal] = useState(false);
  const [showAddSubDomainModal, setShowAddSubDomainModal] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [assetCount, setAssetCount] = useState<number>(0);
  const [dataProductsCount, setDataProductsCount] = useState<number>(0);
  const [subDomains, setSubDomains] = useState<Domain[]>([]);
  const [isSubDomainsLoading, setIsSubDomainsLoading] =
    useState<boolean>(false);
  const encodedFqn = getEncodedFqn(
    escapeESReservedCharacters(domain.fullyQualifiedName)
  );

  const isSubDomain = useMemo(() => !isEmpty(domain.parent), [domain]);

  const isOwner = useMemo(
    () => domain.owners?.some((owner) => isEqual(owner.id, currentUser?.id)),
    [domain, currentUser]
  );

  const breadcrumbs = useMemo(() => {
    if (!domainFqn) {
      return [];
    }

    const arr = Fqn.split(domainFqn);
    const dataFQN: Array<string> = [];

    return [
      {
        name: 'Domains',
        url: getDomainPath(arr[0]),
        activeTitle: false,
      },
      ...arr.slice(0, -1).map((d) => {
        dataFQN.push(d);

        return {
          name: d,
          url: getDomainPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
          activeTitle: false,
        };
      }),
    ];
  }, [domainFqn]);

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

  const editDisplayNamePermission = useMemo(() => {
    return domainPermission.EditAll || domainPermission.EditDisplayName;
  }, [domainPermission]);

  const addButtonContent = [
    ...(domainPermission.Create
      ? [
          {
            label: t('label.asset-plural'),
            key: '1',
            onClick: () => setAssetModalVisible(true),
          },
          {
            label: t('label.sub-domain-plural'),
            key: '2',
            onClick: () => setShowAddSubDomainModal(true),
          },
        ]
      : []),
    ...(isOwner || permissions.dataProduct.Create
      ? [
          {
            label: t('label.data-product-plural'),
            key: '3',
            onClick: () => setShowAddDataProductModal(true),
          },
        ]
      : []),
  ];

  const fetchSubDomains = useCallback(async () => {
    if (!isVersionsView) {
      try {
        setIsSubDomainsLoading(true);
        const res = await searchData(
          '',
          1,
          PAGE_SIZE_LARGE,
          `(parent.fullyQualifiedName:"${encodedFqn}")`,
          '',
          '',
          SearchIndex.DOMAIN
        );

        const data = formatDomainsResponse(res.data.hits.hits);
        setSubDomains(data);
      } catch (error) {
        setSubDomains([]);
      } finally {
        setIsSubDomainsLoading(false);
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
        fetchSubDomains();
      } catch (error) {
        showErrorToast(
          getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
            ? t('server.entity-already-exist', {
                entity: t('label.sub-domain'),
                entityPlural: t('label.sub-domain-lowercase-plural'),
                name: data.name,
              })
            : (error as AxiosError),
          t('server.add-entity-error', {
            entity: t('label.sub-domain-lowercase'),
          })
        );
      } finally {
        setShowAddSubDomainModal(false);
      }
    },
    [domain, fetchSubDomains]
  );

  const addDataProduct = useCallback(
    async (formData: CreateDomain | CreateDataProduct) => {
      const data = {
        ...formData,
        domain: domain.fullyQualifiedName,
      };

      try {
        const res = await addDataProducts(data as CreateDataProduct);
        history.push(
          getEntityDetailsPath(
            EntityType.DATA_PRODUCT,
            res.fullyQualifiedName ?? ''
          )
        );
      } catch (error) {
        showErrorToast(
          getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
            ? t('server.entity-already-exist', {
                entity: t('label.sub-domain'),
                entityPlural: t('label.sub-domain-lowercase-plural'),
                name: data.name,
              })
            : (error as AxiosError),
          t('server.add-entity-error', {
            entity: t('label.sub-domain-lowercase'),
          })
        );
      } finally {
        setShowAddDataProductModal(false);
      }
    },
    [domain]
  );

  const handleVersionClick = async () => {
    const path = isVersionsView
      ? getDomainPath(domainFqn)
      : getDomainVersionsPath(domainFqn, toString(domain.version));

    history.push(path);
  };

  const fetchDataProducts = async () => {
    if (!isVersionsView) {
      try {
        const res = await searchData(
          '',
          1,
          0,
          `(domain.fullyQualifiedName:"${encodedFqn}")`,
          '',
          '',
          SearchIndex.DATA_PRODUCT
        );

        setDataProductsCount(res.data.hits.total.value ?? 0);
      } catch (error) {
        setDataProductsCount(0);
      }
    }
  };

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
      showErrorToast(error as AxiosError);
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey === 'assets') {
      // refresh domain count when assets tab is selected
      fetchDomainAssets();
    }
    if (activeKey !== activeTab) {
      history.push(getDomainDetailsPath(domainFqn, activeKey));
    }
  };

  const onAddDataProduct = useCallback(() => {
    setShowAddDataProductModal(true);
  }, []);

  const onNameSave = (obj: EntityName) => {
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
      color: data.color ? data.color : undefined,
      iconURL: data.iconURL ? data.iconURL : undefined,
    };
    const updatedDetails = {
      ...domain,
      style,
    };

    await onUpdate(updatedDetails);
    setIsStyleEditing(false);
  };

  const handleAssetSave = () => {
    fetchDomainAssets();
    assetTabRef.current?.refreshAssets();
    activeTab !== 'assets' && handleTabChange('assets');
  };

  const handleAssetClick = useCallback((asset) => {
    setPreviewAsset(asset);
  }, []);

  const handleCloseDataProductModal = useCallback(
    () => setShowAddDataProductModal(false),
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

  const queryFilter = useMemo(() => {
    return getQueryFilterForDomain(domainFqn);
  }, [domainFqn]);

  const tabs = useMemo(() => {
    return [
      {
        label: (
          <TabsLabel
            id={DomainTabs.DOCUMENTATION}
            name={t('label.documentation')}
          />
        ),
        key: DomainTabs.DOCUMENTATION,
        children: (
          <DocumentationTab
            domain={domain}
            isVersionsView={isVersionsView}
            permissions={domainPermission}
            onUpdate={(data: Domain | DataProduct) => onUpdate(data as Domain)}
          />
        ),
      },
      ...(!isVersionsView
        ? [
            {
              label: (
                <TabsLabel
                  count={subDomains.length ?? 0}
                  id={DomainTabs.SUBDOMAINS}
                  isActive={activeTab === DomainTabs.SUBDOMAINS}
                  name={t('label.sub-domain-plural')}
                />
              ),
              key: DomainTabs.SUBDOMAINS,
              children: (
                <SubDomainsTable
                  isLoading={isSubDomainsLoading}
                  permissions={domainPermission}
                  subDomains={subDomains}
                  onAddSubDomain={() => setShowAddSubDomainModal(true)}
                />
              ),
            },
            {
              label: (
                <TabsLabel
                  count={dataProductsCount ?? 0}
                  id={DomainTabs.DATA_PRODUCTS}
                  isActive={activeTab === DomainTabs.DATA_PRODUCTS}
                  name={t('label.data-product-plural')}
                />
              ),
              key: DomainTabs.DATA_PRODUCTS,
              children: (
                <DataProductsTab
                  permissions={domainPermission}
                  ref={dataProductsTabRef}
                  onAddDataProduct={onAddDataProduct}
                />
              ),
            },
            {
              label: (
                <TabsLabel
                  count={assetCount ?? 0}
                  id={DomainTabs.ASSETS}
                  isActive={activeTab === DomainTabs.ASSETS}
                  name={t('label.asset-plural')}
                />
              ),
              key: DomainTabs.ASSETS,
              children: (
                <ResizablePanels
                  className="domain-height-with-resizable-panel"
                  firstPanel={{
                    className: 'domain-resizable-panel-container',
                    children: (
                      <div className="p-x-md p-y-md">
                        <AssetsTabs
                          assetCount={assetCount}
                          entityFqn={domainFqn}
                          isSummaryPanelOpen={false}
                          permissions={domainPermission}
                          queryFilter={queryFilter}
                          ref={assetTabRef}
                          type={AssetsOfEntity.DOMAIN}
                          onAddAsset={() => setAssetModalVisible(true)}
                          onAssetClick={handleAssetClick}
                          onRemoveAsset={handleAssetSave}
                        />
                      </div>
                    ),
                    minWidth: 800,
                    flex: 0.87,
                  }}
                  hideSecondPanel={!previewAsset}
                  pageTitle={t('label.domain')}
                  secondPanel={{
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
    ];
  }, [
    domain,
    domainPermission,
    previewAsset,
    handleAssetClick,
    handleAssetSave,
    assetCount,
    dataProductsCount,
    activeTab,
    subDomains,
    isSubDomainsLoading,
    queryFilter,
  ]);

  useEffect(() => {
    fetchDomainPermission();
    fetchDomainAssets();
    fetchDataProducts();
  }, [domain.fullyQualifiedName]);

  useEffect(() => {
    fetchSubDomains();
  }, [domainFqn]);

  const iconData = useMemo(() => {
    if (domain.style?.iconURL) {
      return (
        <img
          alt="domain-icon"
          className="align-middle"
          data-testid="icon"
          height={36}
          src={domain.style.iconURL}
          width={32}
        />
      );
    } else if (isSubDomain) {
      return (
        <SubDomainIcon
          className="align-middle"
          color={DE_ACTIVE_COLOR}
          height={36}
          name="folder"
          width={32}
        />
      );
    }

    return (
      <DomainIcon
        className="align-middle"
        color={DE_ACTIVE_COLOR}
        height={36}
        name="folder"
        width={32}
      />
    );
  }, [domain, isSubDomain]);

  return (
    <>
      <Row
        className="domain-details"
        data-testid="domain-details"
        gutter={[0, 12]}>
        <Col className="p-x-md p-l-xl" flex="auto">
          <EntityHeader
            breadcrumb={breadcrumbs}
            entityData={{ ...domain, displayName, name }}
            entityType={EntityType.DOMAIN}
            icon={iconData}
            serviceName=""
            titleColor={domain.style?.color}
          />
        </Col>
        <Col className="p-x-md" flex="320px">
          <div style={{ textAlign: 'right' }}>
            {!isVersionsView && addButtonContent.length > 0 && (
              <Dropdown
                className="m-l-xs"
                data-testid="domain-details-add-button-menu"
                menu={{
                  items: addButtonContent,
                }}
                placement="bottomRight"
                trigger={['click']}>
                <Button data-testid="domain-details-add-button" type="primary">
                  <Space>
                    {t('label.add')}
                    <DownOutlined />
                  </Space>
                </Button>
              </Dropdown>
            )}

            <ButtonGroup className="p-l-xs" size="small">
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

      {showAddDataProductModal && (
        <Modal
          centered
          cancelText={t('label.cancel')}
          className="add-data-product-modal"
          closable={false}
          footer={[
            <Button
              key="cancel-btn"
              type="link"
              onClick={handleCloseDataProductModal}>
              {t('label.cancel')}
            </Button>,
            <Button
              data-testid="save-data-product"
              key="save-btn"
              type="primary"
              onClick={() => form.submit()}>
              {t('label.save')}
            </Button>,
          ]}
          maskClosable={false}
          okText={t('label.submit')}
          open={showAddDataProductModal}
          title={t('label.add-entity', { entity: t('label.data-product') })}
          width={750}
          onCancel={handleCloseDataProductModal}>
          <AddDomainForm
            isFormInDialog
            formRef={form}
            loading={false}
            type={DomainFormType.DATA_PRODUCT}
            onCancel={handleCloseDataProductModal}
            onSubmit={addDataProduct}
          />
        </Modal>
      )}
      {assetModalVisible && (
        <AssetSelectionModal
          entityFqn={domainFqn}
          open={assetModalVisible}
          queryFilter={getQueryFilterToExcludeDomainTerms(domainFqn)}
          type={AssetsOfEntity.DOMAIN}
          onCancel={() => setAssetModalVisible(false)}
          onSave={handleAssetSave}
        />
      )}

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
      <EntityNameModal
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
      {showAddSubDomainModal && (
        <AddSubDomainModal
          open={showAddSubDomainModal}
          onCancel={() => setShowAddSubDomainModal(false)}
          onSubmit={(data: CreateDomain) => addSubDomain(data)}
        />
      )}
    </>
  );
};

export default DomainDetailsPage;
