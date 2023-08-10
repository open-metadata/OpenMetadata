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
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { EntityHeader } from 'components/Entity/EntityHeader/EntityHeader.component';
import Loader from 'components/Loader/Loader';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { EntityType } from 'enums/entity.enum';
import { Domain } from 'generated/entity/domains/domain';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getDomainPath } from 'utils/RouterUtils';
import Fqn from '../../../utils/Fqn';
import '../domain.less';
import { DomainTabs } from '../DomainPage.interface';

interface props {
  domain: Domain;
  loading: boolean;
}

const DomainDetailsPage = ({ domain, loading }: props) => {
  const { t } = useTranslation();
  const { fqn, tab: activeTab } = useParams<{ fqn: string; tab: string }>();
  const domainFqn = fqn ? decodeURIComponent(fqn) : null;

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
  }, []);

  const addButtonContent = [
    {
      label: t('label.asset-plural'),
      key: '1',
    },
    {
      label: t('label.sub-domain-plural'),
      key: '2',
    },
    {
      label: t('label.data-product-plural'),
      key: '3',
    },
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
          <RichTextEditorPreviewer
            className="p-x-md"
            enableSeeMoreVariant={false}
            markdown={domain.description}
          />
        ),
      },
      {
        label: (
          <TabsLabel
            id={DomainTabs.DATA_PRODUCTS}
            name={t('label.data-product-plural')}
          />
        ),
        key: DomainTabs.DATA_PRODUCTS,
        children: <></>,
      },
      {
        label: (
          <TabsLabel id={DomainTabs.ASSETS} name={t('label.asset-plural')} />
        ),
        key: DomainTabs.ASSETS,
        children: <></>,
      },
      {
        label: (
          <TabsLabel
            id={DomainTabs.SUBDOMAINS}
            name={t('label.sub-domain-plural')}
          />
        ),
        key: DomainTabs.SUBDOMAINS,
        children: <></>,
      },
    ];
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <Row
      className="domain-details"
      data-testid="domain-details"
      gutter={[0, 32]}>
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
        />
      </Col>
    </Row>
  );
};

export default DomainDetailsPage;
