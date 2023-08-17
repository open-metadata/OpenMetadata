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
import { DownOutlined } from '@ant-design/icons';
import { Button, Col, Dropdown, Row, Space, Tabs } from 'antd';
import { ReactComponent as DomainIcon } from 'assets/svg/ic-domain.svg';
import { AxiosError } from 'axios';
import { AssetSelectionModal } from 'components/Assets/AssetsSelectionModal/AssetSelectionModal';
import { EntityHeader } from 'components/Entity/EntityHeader/EntityHeader.component';
import AssetsTabs, {
  AssetsTabRef,
} from 'components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from 'components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { DE_ACTIVE_COLOR, ERROR_MESSAGE } from 'constants/constants';
import { EntityType } from 'enums/entity.enum';
import { CreateDataProduct } from 'generated/api/domains/createDataProduct';
import { CreateDomain } from 'generated/api/domains/createDomain';
import { Domain } from 'generated/entity/domains/domain';
import { noop } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { addDataProducts } from 'rest/dataProductAPI';
import { getIsErrorMatch } from 'utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { getDomainDetailsPath, getDomainPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';
import Fqn from '../../../utils/Fqn';
import AddDataProductModal from '../AddDataProductModal/AddDataProductModal.component';
import '../domain.less';
import { DomainTabs } from '../DomainPage.interface';
import DataProductsTab from '../DomainTabs/DataProductsTab/DataProductsTab.component';
import DocumentationTab from '../DomainTabs/DocumentationTab/DocumentationTab.component';

interface props {
  domain: Domain;
  loading: boolean;
  onUpdate: (value: Domain) => Promise<void>;
}

const DomainDetailsPage = ({ domain, loading, onUpdate }: props) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();
  const history = useHistory();
  const { fqn, tab: activeTab } = useParams<{ fqn: string; tab: string }>();
  const domainFqn = fqn ? decodeURIComponent(fqn) : '';
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [domainPermission, setDomainPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [assetModalVisible, setAssetModelVisible] = useState(false);
  const [showAddDataProductModal, setShowAddDataProductModal] = useState(false);

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
        domain: domain.name,
      };

      try {
        await addDataProducts(data as CreateDataProduct);
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

  const fetchDomainPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.DOMAIN,
        domain.id as string
      );
      setDomainPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getDomainDetailsPath(domainFqn, activeKey));
    }
  };

  const onAddDataProduct = useCallback(() => {
    setShowAddDataProductModal(true);
  }, []);

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
        children: <DocumentationTab domain={domain} onUpdate={onUpdate} />,
      },
      {
        label: (
          <TabsLabel
            id={DomainTabs.DATA_PRODUCTS}
            name={t('label.data-product-plural')}
          />
        ),
        key: DomainTabs.DATA_PRODUCTS,
        children: (
          <DataProductsTab
            permissions={domainPermission}
            onAddDataProduct={onAddDataProduct}
          />
        ),
      },
      {
        label: (
          <TabsLabel id={DomainTabs.ASSETS} name={t('label.asset-plural')} />
        ),
        key: DomainTabs.ASSETS,
        children: (
          <AssetsTabs
            isSummaryPanelOpen={false}
            permissions={domainPermission}
            ref={assetTabRef}
            onAddAsset={() => setAssetModelVisible(true)}
          />
        ),
      },
    ];
  }, [domain, domainPermission]);

  useEffect(() => {
    fetchDomainPermission();
  }, [fqn]);

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <Row
        className="domain-details"
        data-testid="domain-details"
        gutter={[0, 12]}>
        <Col className="p-x-md" flex="auto">
          <EntityHeader
            breadcrumb={breadcrumbs}
            entityData={domain}
            entityType={EntityType.DOMAIN}
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
            <Dropdown
              className="m-l-xs"
              menu={{
                items: addButtonContent,
              }}
              placement="bottomRight"
              trigger={['click']}>
              <Button type="primary">
                <Space>
                  {t('label.add')}
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
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
      <AddDataProductModal
        open={showAddDataProductModal}
        onCancel={() => setShowAddDataProductModal(false)}
        onSubmit={(data: CreateDomain | CreateDataProduct) =>
          addDataProduct(data as CreateDataProduct)
        }
      />
      <AssetSelectionModal
        entityFqn={domainFqn}
        open={assetModalVisible}
        type={AssetsOfEntity.DOMAIN}
        onCancel={() => setAssetModelVisible(false)}
        onSave={noop}
      />
    </>
  );
};

export default DomainDetailsPage;
