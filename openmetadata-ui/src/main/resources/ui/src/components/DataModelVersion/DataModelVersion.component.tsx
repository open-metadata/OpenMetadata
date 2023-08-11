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
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import DataAssetsVersionHeader from 'components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import EntityVersionTimeLine from 'components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import VersionTable from 'components/VersionTable/VersionTable.component';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityTabs, EntityType, FqnPart } from 'enums/entity.enum';
import {
  ChangeDescription,
  Column,
  DashboardDataModel,
} from 'generated/entity/data/dashboardDataModel';
import { TagSource } from 'generated/type/schema';
import { EntityDiffProps } from 'interface/EntityVersion.interface';
import { cloneDeep, isEqual } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPartialNameFromTableFQN } from 'utils/CommonUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getChangedEntityName,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getCommonExtraInfoForVersionDetails,
  getDiffByFieldName,
  getEntityVersionByField,
  getEntityVersionTags,
  getTagsDiff,
  getTextDiff,
  isEndsWithField,
} from '../../utils/EntityVersionUtils';
import { TagLabelWithStatus } from '../../utils/EntityVersionUtils.interface';
import Loader from '../Loader/Loader';
import { DataModelVersionProp } from './DataModelVersion.interface';

const DataModelVersion: FC<DataModelVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedDataModelName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
  dataModelFQN,
  entityPermissions,
}: DataModelVersionProp) => {
  const { t } = useTranslation();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const getChangeColName = (name: string | undefined) => {
    const nameArr = name?.split(FQN_SEPARATOR_CHAR);

    if (nameArr?.length === 3) {
      return nameArr.slice(-2, -1)[0];
    } else {
      return nameArr?.slice(-3, -1)?.join('.');
    }
  };

  const { ownerDisplayName, ownerRef, tierDisplayName } = useMemo(
    () => getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
    [changeDescription, owner, tier]
  );

  const handleColumnDescriptionChangeDiff = (
    colList: DashboardDataModel['columns'],
    columnsDiff: EntityDiffProps,
    changedColName: string | undefined
  ) => {
    const oldDescription = getChangedEntityOldValue(columnsDiff);
    const newDescription = getChangedEntityNewValue(columnsDiff);

    const formatColumnData = (arr: DashboardDataModel['columns']) => {
      arr?.forEach((i) => {
        if (isEqual(i.name, changedColName)) {
          i.description = getTextDiff(
            oldDescription ?? '',
            newDescription ?? '',
            i.description
          );
        } else {
          formatColumnData(i?.children as DashboardDataModel['columns']);
        }
      });
    };

    formatColumnData(colList);
  };

  const handleColumnTagChangeDiff = (
    colList: DashboardDataModel['columns'],
    columnsDiff: EntityDiffProps,
    changedColName: string | undefined
  ) => {
    const oldTags: Array<TagLabel> = JSON.parse(
      getChangedEntityOldValue(columnsDiff) ?? '[]'
    );
    const newTags: Array<TagLabel> = JSON.parse(
      getChangedEntityNewValue(columnsDiff) ?? '[]'
    );

    const formatColumnData = (arr: DashboardDataModel['columns']) => {
      arr?.forEach((i) => {
        if (isEqual(i.name, changedColName)) {
          const flag: { [x: string]: boolean } = {};
          const uniqueTags: Array<TagLabelWithStatus> = [];
          const tagsDiff = getTagsDiff(oldTags, newTags);
          [...tagsDiff, ...(i.tags as Array<TagLabelWithStatus>)].forEach(
            (elem: TagLabelWithStatus) => {
              if (!flag[elem.tagFQN]) {
                flag[elem.tagFQN] = true;
                uniqueTags.push(elem);
              }
            }
          );
          i.tags = uniqueTags;
        } else {
          formatColumnData(i?.children as DashboardDataModel['columns']);
        }
      });
    };

    formatColumnData(colList);
  };

  const handleColumnDiffAdded = (
    colList: DashboardDataModel['columns'],
    columnsDiff: EntityDiffProps
  ) => {
    const newCol: Array<Column> = JSON.parse(
      columnsDiff.added?.newValue ?? '[]'
    );
    newCol.forEach((col) => {
      const formatColumnData = (arr: DashboardDataModel['columns']) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, col.name)) {
            i.tags = col.tags?.map((tag) => ({ ...tag, added: true }));
            i.description = getTextDiff('', col.description ?? '');
            i.dataTypeDisplay = getTextDiff('', col.dataTypeDisplay ?? '');
            i.name = getTextDiff('', col.name);
          } else {
            formatColumnData(i?.children as DashboardDataModel['columns']);
          }
        });
      };
      formatColumnData(colList);
    });
  };

  const handleColumnDiffDeleted = (columnsDiff: EntityDiffProps) => {
    const newCol: Array<Column> = JSON.parse(
      columnsDiff.deleted?.oldValue ?? '[]'
    );

    return newCol.map((col) => ({
      ...col,
      tags: col.tags?.map((tag) => ({ ...tag, removed: true })),
      description: getTextDiff(col.description ?? '', ''),
      dataTypeDisplay: getTextDiff(col.dataTypeDisplay ?? '', ''),
      name: getTextDiff(col.name, ''),
    }));
  };

  const columns: DashboardDataModel['columns'] = useMemo(() => {
    const colList = cloneDeep(
      (currentVersionData as DashboardDataModel).columns || []
    );
    const columnsDiff = getDiffByFieldName(
      EntityField.COLUMNS,
      changeDescription
    );
    const changedColName = getChangeColName(getChangedEntityName(columnsDiff));
    const colNameWithoutQuotes = changedColName?.replaceAll(/(^")|("$)/g, '');

    if (
      isEndsWithField(
        EntityField.DESCRIPTION,
        getChangedEntityName(columnsDiff)
      )
    ) {
      handleColumnDescriptionChangeDiff(
        colList,
        columnsDiff,
        colNameWithoutQuotes
      );

      return colList;
    } else if (
      isEndsWithField(EntityField.TAGS, getChangedEntityName(columnsDiff))
    ) {
      handleColumnTagChangeDiff(colList, columnsDiff, colNameWithoutQuotes);

      return colList;
    } else {
      const columnsDiff = getDiffByFieldName(
        EntityField.COLUMNS,
        changeDescription,
        true
      );
      let newColumns: Column[] = [];
      if (columnsDiff.added) {
        handleColumnDiffAdded(colList, columnsDiff);
      }
      if (columnsDiff.deleted) {
        newColumns = handleColumnDiffDeleted(columnsDiff);
      } else {
        return colList;
      }

      return [...newColumns, ...colList];
    }
  }, [
    currentVersionData,
    changeDescription,
    getChangeColName,
    handleColumnDescriptionChangeDiff,
  ]);

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

  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: EntityTabs.MODEL,
        label: <TabsLabel id={EntityTabs.MODEL} name={t('label.model')} />,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    isVersionView
                    description={description}
                    entityType={EntityType.DASHBOARD_DATA_MODEL}
                  />
                </Col>
                <Col span={24}>
                  <VersionTable
                    columnName={getPartialNameFromTableFQN(
                      dataModelFQN,
                      [FqnPart.Column],
                      FQN_SEPARATOR_CHAR
                    )}
                    columns={columns}
                    joins={[]}
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
                    entityFqn={currentVersionData.fullyQualifiedName}
                    entityType={EntityType.DASHBOARD_DATA_MODEL}
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
    ],
    [description, dataModelFQN, columns]
  );

  if (!(entityPermissions.ViewAll || entityPermissions.ViewBasic)) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <>
      <div data-testid="data-model-version-container">
        {isVersionLoading ? (
          <Loader />
        ) : (
          <div
            className={classNames('version-data')}
            data-testid="version-data">
            <Row gutter={[0, 12]}>
              <Col span={24}>
                <DataAssetsVersionHeader
                  breadcrumbLinks={slashedDataModelName}
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
                <Tabs activeKey={EntityTabs.MODEL} items={tabItems} />
              </Col>
            </Row>
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
    </>
  );
};

export default DataModelVersion;
