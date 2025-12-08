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

import { Col, Row, Space, Tabs, TabsProps, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { toString } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomizeEntityType } from '../../../../constants/Customize.constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import {
  ChangeDescription,
  EntityReference,
  Spreadsheet,
} from '../../../../generated/entity/data/spreadsheet';
import { Operation } from '../../../../generated/entity/policies/policy';
import { TagSource } from '../../../../generated/type/tagLabel';
import { useFqn } from '../../../../hooks/useFqn';
import { getDriveAssetByFqn } from '../../../../rest/driveAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getCommonExtraInfoForVersionDetails,
  getConstraintChanges,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../../utils/EntityVersionUtils';
import { getPrioritizedViewPermission } from '../../../../utils/PermissionsUtils';
import { getVersionPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import Loader from '../../../common/Loader/Loader';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../../common/Table/Table';
import TabsLabel from '../../../common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../../Customization/GenericProvider/GenericProvider';
import DataAssetsVersionHeader from '../../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import DataProductsContainer from '../../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { SpreadsheetVersionProps } from './SpreadsheetVersion.interface';

const SpreadsheetVersion = ({
  version,
  currentVersionData,
  isVersionLoading,
  owners,
  domains,
  dataProducts,
  tier,
  breadCrumbList,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
  entityPermissions,
}: Readonly<SpreadsheetVersionProps>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: spreadsheetFQN } = useFqn();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );
  const [spreadsheetDetails, setSpreadsheetDetails] =
    useState<Spreadsheet>(currentVersionData);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const entityFqn = useMemo(
    () => currentVersionData.fullyQualifiedName ?? '',
    [currentVersionData.fullyQualifiedName ?? '']
  );

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          changeDescription,
          owners,
          tier,
          domains
        ),
      [changeDescription, owners, tier, domains]
    );

  const handleTabChange = (activeKey: string) => {
    navigate(
      getVersionPath(
        EntityType.SPREADSHEET,
        entityFqn,
        String(version),
        activeKey
      )
    );
  };

  const tags = useMemo(() => {
    return getEntityVersionTags(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  const description = useMemo(() => {
    return getEntityVersionByField(
      changeDescription,
      EntityField.DESCRIPTION,
      currentVersionData.description
    );
  }, [currentVersionData, changeDescription]);

  const displayName = useMemo(() => {
    return getEntityVersionByField(
      changeDescription,
      EntityField.DISPLAYNAME,
      currentVersionData.displayName
    );
  }, [currentVersionData, changeDescription]);

  const {
    addedConstraintDiffs: addedColumnConstraintDiffs,
    deletedConstraintDiffs: deletedColumnConstraintDiffs,
  } = useMemo(
    () => getConstraintChanges(changeDescription, EntityField.CONSTRAINT),
    [changeDescription]
  );

  const tableColumn: ColumnsType<EntityReference> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => (
          <Typography.Text>{getEntityName(record)}</Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text) =>
          text ? (
            <RichTextEditorPreviewerNew markdown={text} />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
    ],
    []
  );

  const viewCustomPropertiesPermission = useMemo(() => {
    return getPrioritizedViewPermission(
      entityPermissions,
      Operation.ViewCustomFields
    );
  }, [entityPermissions]);

  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: EntityTabs.SCHEMA,
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        children: (
          <Row className="h-full" gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    description={description}
                    entityType={EntityType.SPREADSHEET}
                    showActions={false}
                  />
                </Col>
                <Col span={24}>
                  <Table
                    columns={tableColumn}
                    data-testid="spreadsheet-children-table"
                    dataSource={spreadsheetDetails.worksheets}
                    pagination={false}
                    rowKey="name"
                    size="small"
                  />
                </Col>
              </Row>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="220px">
              <Space className="w-full" direction="vertical" size="large">
                <DataProductsContainer
                  newLook
                  activeDomains={domains}
                  dataProducts={dataProducts ?? []}
                  hasPermission={false}
                />

                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    newLook
                    entityType={EntityType.SPREADSHEET}
                    key={tagType}
                    permission={false}
                    selectedTags={tags}
                    tagType={TagSource[tagType as TagSource]}
                  />
                ))}
              </Space>
            </Col>
          </Row>
        ),
      },
      {
        key: EntityTabs.CUSTOM_PROPERTIES,
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        children: (
          <CustomPropertyTable
            isVersionView
            entityType={EntityType.SPREADSHEET}
            hasEditAccess={false}
            hasPermission={viewCustomPropertiesPermission}
          />
        ),
      },
    ],
    [
      description,
      entityFqn,
      currentVersionData,
      viewCustomPropertiesPermission,
      addedColumnConstraintDiffs,
      deletedColumnConstraintDiffs,
      spreadsheetDetails,
    ]
  );

  const fetchSpreadsheetDetails = async (spreadsheetFQN: string) => {
    setIsLoading(true);
    try {
      const res = await getDriveAssetByFqn<Spreadsheet>(
        spreadsheetFQN,
        EntityType.SPREADSHEET,
        'worksheets'
      );
      const { worksheets } = res;

      setSpreadsheetDetails((prev) => ({ ...prev, worksheets }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.spreadsheet'),
          entityName: spreadsheetFQN,
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpreadsheetDetails(spreadsheetFQN);
  }, []);

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  return (
    <>
      {isVersionLoading || isLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')}>
          <Row gutter={[0, 12]}>
            <Col span={24}>
              <DataAssetsVersionHeader
                breadcrumbLinks={breadCrumbList}
                currentVersionData={currentVersionData}
                deleted={deleted}
                displayName={displayName}
                domainDisplayName={domainDisplayName}
                entityType={EntityType.SPREADSHEET}
                ownerDisplayName={ownerDisplayName}
                ownerRef={ownerRef}
                serviceName={currentVersionData.service?.name}
                tierDisplayName={tierDisplayName}
                version={version}
                onVersionClick={backHandler}
              />
            </Col>
            <GenericProvider
              isVersionView
              currentVersionData={currentVersionData}
              data={currentVersionData}
              permissions={entityPermissions}
              type={EntityType.SPREADSHEET as CustomizeEntityType}
              onUpdate={() => Promise.resolve()}>
              <Col className="entity-version-page-tabs" span={24}>
                <Tabs
                  className="tabs-new"
                  defaultActiveKey={tab}
                  items={tabItems}
                  onChange={handleTabChange}
                />
              </Col>
            </GenericProvider>
          </Row>
        </div>
      )}

      <EntityVersionTimeLine
        currentVersion={toString(version)}
        entityType={EntityType.SPREADSHEET}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default SpreadsheetVersion;
