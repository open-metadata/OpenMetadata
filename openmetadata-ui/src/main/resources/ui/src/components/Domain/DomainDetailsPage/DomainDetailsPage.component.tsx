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
  Row,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
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
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
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
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { DE_ACTIVE_COLOR, ERROR_MESSAGE } from '../../../constants/constants';
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
import { useFqn } from '../../../hooks/useFqn';
import { addDataProducts } from '../../../rest/dataProductAPI';
import { searchData } from '../../../rest/miscAPI';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
import { getQueryFilterToExcludeDomainTerms } from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import Fqn from '../../../utils/Fqn';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  getDataProductsDetailsPath,
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
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { AssetSelectionModal } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import StyleModal from '../../Modals/StyleModal/StyleModal.component';
import AddDataProductModal from '../AddDataProductModal/AddDataProductModal.component';
import '../domain.less';
import { DomainTabs } from '../DomainPage.interface';
import DataProductsTab from '../DomainTabs/DataProductsTab/DataProductsTab.component';
import { DataProductsTabRef } from '../DomainTabs/DataProductsTab/DataProductsTab.interface';
import DocumentationTab from '../DomainTabs/DocumentationTab/DocumentationTab.component';
import { DomainDetailsPageProps } from './DomainDetailsPage.interface';

const DomainDetailsPage = ({
  domain,
  onUpdate,
  onDelete,
  isVersionsView = false,
}: DomainDetailsPageProps) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();
  const history = useHistory();
  const { tab: activeTab, version } =
    useParams<{ tab: string; version: string }>();
  const { fqn: domainFqn } = useFqn();
  const assetTabRef = useRef<AssetsTabRef>(null);
  const dataProductsTabRef = useRef<DataProductsTabRef>(null);
  const [domainPermission, setDomainPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [assetModalVisible, setAssetModelVisible] = useState(false);
  const [showAddDataProductModal, setShowAddDataProductModal] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [assetCount, setAssetCount] = useState<number>(0);
  const [dataProductsCount, setDataProductsCount] = useState<number>(0);

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
    {
      label: t('label.asset-plural'),
      key: '1',
      onClick: () => setAssetModelVisible(true),
    },
    {
      label: t('label.data-product-plural'),
      key: '2',
      onClick: () => setShowAddDataProductModal(true),
    },
  ];

  const addDataProduct = useCallback(
    async (formData: CreateDataProduct) => {
      const data = {
        ...formData,
        domain: domain.fullyQualifiedName,
      };

      try {
        const res = await addDataProducts(data as CreateDataProduct);
        history.push(getDataProductsDetailsPath(res.fullyQualifiedName ?? ''));
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
        const encodedFqn = getEncodedFqn(
          escapeESReservedCharacters(domain.fullyQualifiedName)
        );
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
        const encodedFqn = getEncodedFqn(
          escapeESReservedCharacters(domain.fullyQualifiedName)
        );
        const res = await searchData(
          '',
          1,
          0,
          `(domain.fullyQualifiedName:"${encodedFqn}") AND !(entityType:"dataProduct")`,
          '',
          '',
          SearchIndex.ALL
        );

        setAssetCount(res.data.hits.total.value ?? 0);
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

  const onNameSave = (obj: { name: string; displayName: string }) => {
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

  const manageButtonContent: ItemType[] = [
    ...(editDisplayNamePermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.rename-entity', {
                  entity: t('label.domain'),
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
    ...(domainPermission?.EditAll
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.edit-entity-style-description', {
                  entity: t('label.domain'),
                })}
                icon={<StyleIcon color={DE_ACTIVE_COLOR} width="18px" />}
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
            onUpdate={(data: Domain | DataProduct) => onUpdate(data as Domain)}
          />
        ),
      },
      ...(!isVersionsView
        ? [
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
                <PageLayoutV1
                  className="domain-asset-page-layout"
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
                    entityFqn={domainFqn}
                    isSummaryPanelOpen={false}
                    permissions={domainPermission}
                    ref={assetTabRef}
                    type={AssetsOfEntity.DOMAIN}
                    onAddAsset={() => setAssetModelVisible(true)}
                    onAssetClick={handleAssetClick}
                    onRemoveAsset={handleAssetSave}
                  />
                </PageLayoutV1>
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
  ]);

  useEffect(() => {
    fetchDomainPermission();
    fetchDomainAssets();
    fetchDataProducts();
  }, [domain.fullyQualifiedName]);

  return (
    <>
      <Row
        className="domain-details"
        data-testid="domain-details"
        gutter={[0, 12]}>
        <Col className="p-x-md" flex="auto">
          <EntityHeader
            breadcrumb={breadcrumbs}
            entityData={{ ...domain, displayName, name }}
            entityType={EntityType.DOMAIN}
            icon={
              domain.style?.iconURL ? (
                <img
                  className="align-middle"
                  data-testid="icon"
                  height={36}
                  src={domain.style.iconURL}
                  width={32}
                />
              ) : (
                <DomainIcon
                  className="align-middle"
                  color={DE_ACTIVE_COLOR}
                  height={36}
                  name="folder"
                  width={32}
                />
              )
            }
            serviceName=""
            titleColor={domain.style?.color}
          />
        </Col>
        <Col className="p-x-md" flex="320px">
          <div style={{ textAlign: 'right' }}>
            {!isVersionsView && domainPermission.Create && (
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
        <AddDataProductModal
          open={showAddDataProductModal}
          onCancel={() => setShowAddDataProductModal(false)}
          onSubmit={(data: CreateDomain | CreateDataProduct) =>
            addDataProduct(data as CreateDataProduct)
          }
        />
      )}
      {assetModalVisible && (
        <AssetSelectionModal
          entityFqn={domainFqn}
          open={assetModalVisible}
          queryFilter={getQueryFilterToExcludeDomainTerms(domainFqn)}
          type={AssetsOfEntity.DOMAIN}
          onCancel={() => setAssetModelVisible(false)}
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
    </>
  );
};

export default DomainDetailsPage;
