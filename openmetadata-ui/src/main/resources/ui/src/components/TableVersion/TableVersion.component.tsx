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
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import DataAssetsVersionHeader from 'components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import EntityVersionTimeLine from 'components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from 'components/Loader/Loader';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import VersionTable from 'components/VersionTable/VersionTable.component';
import { getVersionPathWithTab } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { TagSource } from 'generated/type/tagLabel';
import { cloneDeep, isUndefined, toString } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityTabs, EntityType, FqnPart } from '../../enums/entity.enum';
import {
  ChangeDescription,
  Column,
  ColumnJoins,
  Table,
} from '../../generated/entity/data/table';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import {
  getChangeColumnNameFromDiffValue,
  getColumnsDataWithVersionChanges,
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../utils/EntityVersionUtils';
import { TableVersionProp } from './TableVersion.interface';

const TableVersion: React.FC<TableVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
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

  const { ownerDisplayName, ownerRef, tierDisplayName } = useMemo(
    () => getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
    [changeDescription, owner, tier]
  );

  const columns = useMemo(() => {
    const colList = cloneDeep((currentVersionData as Table).columns);

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

  const constraintUpdatedColumns = useMemo(() => {
    const constraintDiff = changeDescription?.fieldsUpdated;
    const changedColumnsList: string[] = [];

    if (!isUndefined(constraintDiff)) {
      constraintDiff.forEach((diff) => {
        const columnName = getChangeColumnNameFromDiffValue(diff.name);
        if (columnName) {
          changedColumnsList.push(columnName);
        }
      });
    }

    return changedColumnsList;
  }, [changeDescription]);

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
                    columnName={getPartialNameFromTableFQN(
                      datasetFQN,
                      [FqnPart.Column],
                      FQN_SEPARATOR_CHAR
                    )}
                    columns={columns}
                    constraintUpdatedColumns={constraintUpdatedColumns}
                    joins={(currentVersionData as Table).joins as ColumnJoins[]}
                    tableConstraints={
                      (currentVersionData as Table).tableConstraints
                    }
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
        children: !entityPermissions.ViewAll ? (
          <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
        ) : (
          <CustomPropertyTable
            isVersionView
            entityDetails={
              currentVersionData as CustomPropertyProps['entityDetails']
            }
            entityType={EntityType.TABLE}
            hasEditAccess={false}
          />
        ),
      },
    ],
    [
      description,
      datasetFQN,
      columns,
      constraintUpdatedColumns,
      currentVersionData,
      entityPermissions,
    ]
  );

  if (!(entityPermissions.ViewAll || entityPermissions.ViewBasic)) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

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
                ownerDisplayName={ownerDisplayName}
                ownerRef={ownerRef}
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
        show
        currentVersion={toString(version)}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default TableVersion;
