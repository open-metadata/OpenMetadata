/*
 *  Copyright 2022 Collate.
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

import { Card, Space, Table, Tabs } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { getVersionPathWithTab } from 'constants/constants';
import { EntityInfo, EntityTabs, EntityType } from 'enums/entity.enum';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import {
  ChangeDescription,
  Dashboard,
  EntityReference,
} from '../../generated/entity/data/dashboard';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionDescription,
  getEntityVersionTags,
} from '../../utils/EntityVersionUtils';
import SVGIcons from '../../utils/SvgUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import { DashboardVersionProp } from './DashboardVersion.interface';

const DashboardVersion: FC<DashboardVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedDashboardName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
}: DashboardVersionProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const extraInfo = useMemo(() => {
    const { dashboardUrl, serviceType, displayName, name } =
      currentVersionData as Dashboard;

    return [
      ...getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
      ...(dashboardUrl
        ? [
            {
              key: `${serviceType} ${EntityInfo.URL}`,
              value: dashboardUrl,
              placeholderText: displayName ?? name,
              isLink: true,
              openInNewTab: true,
            },
          ]
        : []),
    ];
  }, [currentVersionData, changeDescription, owner, tier]);

  const handleTabChange = (activeKey: string) => {
    history.push(
      getVersionPathWithTab(
        EntityType.DASHBOARD,
        currentVersionData.fullyQualifiedName ?? '',
        String(version),
        activeKey
      )
    );
  };

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  const tableColumn: ColumnsType<EntityReference> = useMemo(
    () => [
      {
        title: t('label.chart-entity', {
          entity: t('label.name'),
        }),
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <Link target="_blank" to={{ pathname: text }}>
            <Space>
              <span>{getEntityName(record)}</span>
              <SVGIcons
                alt="external-link"
                className="tw-align-middle"
                icon="external-link"
                width="16px"
              />
            </Space>
          </Link>
        ),
      },
      {
        title: t('label.chart-entity', {
          entity: t('label.type'),
        }),
        dataIndex: 'type',
        key: 'type',
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text) =>
          text ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'tags',
      },
    ],
    []
  );

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      <div data-testid="dashboard-version-container">
        {isVersionLoading ? (
          <Loader />
        ) : (
          <div
            className={classNames('version-data')}
            data-testid="version-data">
            <EntityPageInfo
              isVersionSelected
              deleted={deleted}
              displayName={currentVersionData.displayName}
              entityName={currentVersionData.name ?? ''}
              extraInfo={extraInfo}
              followersList={[]}
              serviceType={currentVersionData.serviceType ?? ''}
              tags={getEntityVersionTags(currentVersionData, changeDescription)}
              tier={{} as TagLabel}
              titleLinks={slashedDashboardName}
              version={Number(version)}
              versionHandler={backHandler}
            />
            <div className="tw-mt-1 d-flex flex-col flex-grow ">
              <Tabs
                data-testid="tabs"
                defaultActiveKey={tab ?? EntityTabs.DETAILS}
                onChange={handleTabChange}>
                <Tabs.TabPane
                  key={EntityTabs.DETAILS}
                  tab={
                    <TabsLabel
                      id={EntityTabs.DETAILS}
                      name={t('label.detail-plural')}
                    />
                  }>
                  <Card className="m-y-md">
                    <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                      <div className="tw-col-span-full">
                        <Description
                          isReadOnly
                          description={getEntityVersionDescription(
                            currentVersionData,
                            changeDescription
                          )}
                        />
                      </div>
                      <div className="m-y-md tw-col-span-full">
                        <Table
                          bordered
                          columns={tableColumn}
                          data-testid="schema-table"
                          dataSource={(currentVersionData as Dashboard)?.charts}
                          pagination={false}
                          rowKey="id"
                          size="small"
                        />
                      </div>
                    </div>
                  </Card>
                </Tabs.TabPane>
                <Tabs.TabPane
                  key={EntityTabs.CUSTOM_PROPERTIES}
                  tab={
                    <TabsLabel
                      id={EntityTabs.CUSTOM_PROPERTIES}
                      name={t('label.custom-property-plural')}
                    />
                  }>
                  <CustomPropertyTable
                    isVersionView
                    entityDetails={
                      currentVersionData as CustomPropertyProps['entityDetails']
                    }
                    entityType={EntityType.DASHBOARD}
                    hasEditAccess={false}
                  />
                </Tabs.TabPane>
              </Tabs>
            </div>
          </div>
        )}

        <EntityVersionTimeLine
          show
          currentVersion={version}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </div>
    </PageLayoutV1>
  );
};

export default DashboardVersion;
