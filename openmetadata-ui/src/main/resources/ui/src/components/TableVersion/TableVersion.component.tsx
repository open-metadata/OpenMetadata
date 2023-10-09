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

import { Col, Row, Space, Tabs, TabsProps } from 'antd';
import classNames from 'classnames';
import { cloneDeep, toString } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/description/DescriptionV1';
import DataAssetsVersionHeader from '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../../components/Loader/Loader';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import VersionTable from '../../components/VersionTable/VersionTable.component';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { getVersionPathWithTab } from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { EntityTabs, EntityType, FqnPart } from '../../enums/entity.enum';
import {
  ChangeDescription,
  Column,
  ColumnJoins,
} from '../../generated/entity/data/table';
import { TagSource } from '../../generated/type/tagLabel';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import {
  getColumnsDataWithVersionChanges,
  getCommonExtraInfoForVersionDetails,
  getConstraintChanges,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../utils/EntityVersionUtils';
import { TableVersionProp } from './TableVersion.interface';

const TableVersion: React.FC<TableVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  domain,
  tier,
  slashedTableName,
  datasetFQN,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
  entityPermissions,
}: TableVersionProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          changeDescription,
          owner,
          tier,
          domain
        ),
      [changeDescription, owner, tier, domain]
    );

  const columns = useMemo(() => {
    const colList = cloneDeep(currentVersionData.columns);

    return getColumnsDataWithVersionChanges<Column>(changeDescription, colList);
  }, [currentVersionData, changeDescription]);

  const handleTabChange = (activeKey: string) => {
    history.push(
      getVersionPathWithTab(
        EntityType.TABLE,
        datasetFQN,
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

  const {
    addedConstraintDiffs: addedTableConstraintDiffs,
    deletedConstraintDiffs: deletedTableConstraintDiffs,
  } = useMemo(
    () =>
      getConstraintChanges(changeDescription, EntityField.TABLE_CONSTRAINTS),
    [changeDescription]
  );

  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: EntityTabs.SCHEMA,
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    isVersionView
                    description={description}
                    entityType={EntityType.TABLE}
                  />
                </Col>
                <Col span={24}>
                  <VersionTable
                    addedColumnConstraintDiffs={addedColumnConstraintDiffs}
                    addedTableConstraintDiffs={addedTableConstraintDiffs}
                    columnName={getPartialNameFromTableFQN(
                      datasetFQN,
                      [FqnPart.Column],
                      FQN_SEPARATOR_CHAR
                    )}
                    columns={columns}
                    deletedColumnConstraintDiffs={deletedColumnConstraintDiffs}
                    deletedTableConstraintDiffs={deletedTableConstraintDiffs}
                    joins={currentVersionData.joins as ColumnJoins[]}
                    tableConstraints={currentVersionData.tableConstraints}
                  />
                </Col>
              </Row>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="220px">
              <Space className="w-full" direction="vertical" size="large">
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    entityFqn={datasetFQN}
                    entityType={EntityType.TABLE}
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
            entityDetails={currentVersionData}
            entityType={EntityType.TABLE}
            hasEditAccess={false}
            hasPermission={entityPermissions.ViewAll}
          />
        ),
      },
    ],
    [
      description,
      datasetFQN,
      columns,
      deletedColumnConstraintDiffs,
      deletedTableConstraintDiffs,
      addedColumnConstraintDiffs,
      addedTableConstraintDiffs,
      currentVersionData,
      entityPermissions,
    ]
  );

  return (
    <>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')}>
          <Row gutter={[0, 12]}>
            <Col span={24}>
              <DataAssetsVersionHeader
                breadcrumbLinks={slashedTableName}
                currentVersionData={currentVersionData}
                deleted={deleted}
                displayName={displayName}
                domainDisplayName={domainDisplayName}
                entityType={EntityType.TABLE}
                ownerDisplayName={ownerDisplayName}
                ownerRef={ownerRef}
                serviceName={currentVersionData.service?.name}
                tierDisplayName={tierDisplayName}
                version={version}
                onVersionClick={backHandler}
              />
            </Col>
            <Col span={24}>
              <Tabs
                defaultActiveKey={tab ?? EntityTabs.SCHEMA}
                items={tabItems}
                onChange={handleTabChange}
              />
            </Col>
          </Row>
        </div>
      )}

      <EntityVersionTimeLine
        currentVersion={toString(version)}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default TableVersion;
