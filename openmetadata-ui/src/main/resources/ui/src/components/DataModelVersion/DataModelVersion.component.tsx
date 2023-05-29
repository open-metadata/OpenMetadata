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

import { Card, Tabs } from 'antd';
import classNames from 'classnames';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import VersionTable from 'components/VersionTable/VersionTable.component';
import { EntityTabs, FqnPart } from 'enums/entity.enum';
import {
  ChangeDescription,
  Column,
  DashboardDataModel,
} from 'generated/entity/data/dashboardDataModel';
import { ColumnDiffProps } from 'interface/EntityVersion.interface';
import { cloneDeep, isEqual, isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPartialNameFromTableFQN } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { OwnerType } from '../../enums/user.enum';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getDescriptionDiff,
  getDiffByFieldName,
  getDiffValue,
  getTagsDiff,
} from '../../utils/EntityVersionUtils';
import { TagLabelWithStatus } from '../../utils/EntityVersionUtils.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
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
}: DataModelVersionProp) => {
  const { t } = useTranslation();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );
  const tabs = [
    {
      label: t('label.model'),
      key: EntityTabs.MODEL,
    },
  ];

  const getChangeColName = (name: string | undefined) => {
    const nameArr = name?.split(FQN_SEPARATOR_CHAR);

    if (nameArr?.length === 3) {
      return nameArr.slice(-2, -1)[0];
    } else {
      return nameArr?.slice(-3, -1)?.join('.');
    }
  };

  const isEndsWithField = (name: string | undefined, checkWith: string) => {
    return name?.endsWith(checkWith);
  };

  const getDashboardDescription = () => {
    const descriptionDiff = getDiffByFieldName(
      EntityField.DESCRIPTION,
      changeDescription
    );
    const oldDescription =
      descriptionDiff?.added?.oldValue ??
      descriptionDiff?.deleted?.oldValue ??
      descriptionDiff?.updated?.oldValue;
    const newDescription =
      descriptionDiff?.added?.newValue ??
      descriptionDiff?.deleted?.newValue ??
      descriptionDiff?.updated?.newValue;

    return getDescriptionDiff(
      oldDescription,
      newDescription,
      currentVersionData.description
    );
  };

  const getExtraInfo = () => {
    const ownerDiff = getDiffByFieldName('owner', changeDescription);

    const oldOwner = JSON.parse(
      ownerDiff?.added?.oldValue ??
        ownerDiff?.deleted?.oldValue ??
        ownerDiff?.updated?.oldValue ??
        '{}'
    );
    const newOwner = JSON.parse(
      ownerDiff?.added?.newValue ??
        ownerDiff?.deleted?.newValue ??
        ownerDiff?.updated?.newValue ??
        '{}'
    );
    const ownerPlaceHolder = owner?.name ?? owner?.displayName ?? '';

    const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
    const newTier = [
      ...JSON.parse(
        tagsDiff?.added?.newValue ??
          tagsDiff?.deleted?.newValue ??
          tagsDiff?.updated?.newValue ??
          '[]'
      ),
    ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

    const oldTier = [
      ...JSON.parse(
        tagsDiff?.added?.oldValue ??
          tagsDiff?.deleted?.oldValue ??
          tagsDiff?.updated?.oldValue ??
          '[]'
      ),
    ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

    const extraInfo: Array<ExtraInfo> = [
      {
        key: 'Owner',
        value:
          !isUndefined(ownerDiff?.added) ||
          !isUndefined(ownerDiff?.deleted) ||
          !isUndefined(ownerDiff?.updated)
            ? getDiffValue(
                oldOwner?.displayName || oldOwner?.name || '',
                newOwner?.displayName || newOwner?.name || ''
              )
            : ownerPlaceHolder
            ? getDiffValue(ownerPlaceHolder, ownerPlaceHolder)
            : '',
        profileName:
          newOwner?.type === OwnerType.USER ? newOwner?.name : undefined,
      },
      {
        key: 'Tier',
        value:
          !isUndefined(newTier) || !isUndefined(oldTier)
            ? getDiffValue(
                oldTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] || '',
                newTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] || ''
              )
            : tier?.tagFQN
            ? tier?.tagFQN.split(FQN_SEPARATOR_CHAR)[1]
            : '',
      },
    ];

    return extraInfo;
  };

  const getTags = () => {
    const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
    const oldTags: Array<TagLabel> = JSON.parse(
      tagsDiff?.added?.oldValue ??
        tagsDiff?.deleted?.oldValue ??
        tagsDiff?.updated?.oldValue ??
        '[]'
    );
    const newTags: Array<TagLabel> = JSON.parse(
      tagsDiff?.added?.newValue ??
        tagsDiff?.deleted?.newValue ??
        tagsDiff?.updated?.newValue ??
        '[]'
    );
    const flag: { [x: string]: boolean } = {};
    const uniqueTags: Array<TagLabelWithStatus> = [];

    [
      ...(getTagsDiff(oldTags, newTags) ?? []),
      ...(currentVersionData.tags ?? []),
    ].forEach((elem) => {
      if (!flag[elem.tagFQN as string]) {
        flag[elem.tagFQN as string] = true;
        uniqueTags.push(elem as TagLabelWithStatus);
      }
    });

    return [
      ...uniqueTags.map((t) =>
        t.tagFQN.startsWith('Tier')
          ? { ...t, tagFQN: t.tagFQN.split(FQN_SEPARATOR_CHAR)[1] }
          : t
      ),
    ];
  };

  const getColumnDiffValue = (column: ColumnDiffProps) =>
    column?.added?.name ?? column?.deleted?.name ?? column?.updated?.name;

  const getColumnDiffOldValue = (column: ColumnDiffProps) =>
    column?.added?.oldValue ??
    column?.deleted?.oldValue ??
    column?.updated?.oldValue;

  const getColumnDiffNewValue = (column: ColumnDiffProps) =>
    column?.added?.newValue ??
    column?.deleted?.newValue ??
    column?.updated?.newValue;

  const handleColumnDescriptionChangeDiff = (
    colList: DashboardDataModel['columns'],
    columnsDiff: ColumnDiffProps,
    changedColName: string | undefined
  ) => {
    const oldDescription = getColumnDiffOldValue(columnsDiff);
    const newDescription = getColumnDiffNewValue(columnsDiff);

    const formatColumnData = (arr: DashboardDataModel['columns']) => {
      arr?.forEach((i) => {
        if (isEqual(i.name, changedColName)) {
          i.description = getDescriptionDiff(
            oldDescription,
            newDescription,
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
    columnsDiff: ColumnDiffProps,
    changedColName: string | undefined
  ) => {
    const oldTags: Array<TagLabel> = JSON.parse(
      getColumnDiffOldValue(columnsDiff) ?? '[]'
    );
    const newTags: Array<TagLabel> = JSON.parse(
      getColumnDiffNewValue(columnsDiff) ?? '[]'
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
    columnsDiff: ColumnDiffProps
  ) => {
    const newCol: Array<Column> = JSON.parse(
      columnsDiff.added?.newValue ?? '[]'
    );
    newCol.forEach((col) => {
      const formatColumnData = (arr: DashboardDataModel['columns']) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, col.name)) {
            i.tags = col.tags?.map((tag) => ({ ...tag, added: true }));
            i.description = getDescriptionDiff(
              undefined,
              col.description,
              col.description
            );
            i.dataTypeDisplay = getDescriptionDiff(
              undefined,
              col.dataTypeDisplay,
              col.dataTypeDisplay
            );
            i.name = getDescriptionDiff(undefined, col.name, col.name);
          } else {
            formatColumnData(i?.children as DashboardDataModel['columns']);
          }
        });
      };
      formatColumnData(colList);
    });
  };

  const handleColumnDiffDeleted = (columnsDiff: ColumnDiffProps) => {
    const newCol: Array<Column> = JSON.parse(
      columnsDiff.deleted?.oldValue ?? '[]'
    );

    return newCol.map((col) => ({
      ...col,
      tags: col.tags?.map((tag) => ({ ...tag, removed: true })),
      description: getDescriptionDiff(
        col.description,
        undefined,
        col.description
      ),
      dataTypeDisplay: getDescriptionDiff(
        col.dataTypeDisplay,
        undefined,
        col.dataTypeDisplay
      ),
      name: getDescriptionDiff(col.name, undefined, col.name),
    }));
  };

  const updatedColumns = (): DashboardDataModel['columns'] => {
    const colList = cloneDeep(
      (currentVersionData as DashboardDataModel).columns || []
    );
    const columnsDiff = getDiffByFieldName(
      EntityField.COLUMNS,
      changeDescription
    );
    const changedColName = getChangeColName(getColumnDiffValue(columnsDiff));

    if (
      isEndsWithField(getColumnDiffValue(columnsDiff), EntityField.DESCRIPTION)
    ) {
      handleColumnDescriptionChangeDiff(colList, columnsDiff, changedColName);

      return colList;
    } else if (isEndsWithField(getColumnDiffValue(columnsDiff), 'tags')) {
      handleColumnTagChangeDiff(colList, columnsDiff, changedColName);

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
  };

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  return (
    <PageContainerV1>
      <PageLayoutV1
        pageTitle={t('label.entity-detail-plural', {
          entity: getEntityName(currentVersionData),
        })}>
        <div data-testid="data-model-version-container">
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
                extraInfo={getExtraInfo()}
                followersList={[]}
                serviceType={currentVersionData.serviceType ?? ''}
                tags={getTags()}
                tier={{} as TagLabel}
                titleLinks={slashedDataModelName}
                version={Number(version)}
                versionHandler={backHandler}
              />
              <div className="tw-mt-1 d-flex flex-col flex-grow ">
                <Tabs activeKey={EntityTabs.MODEL} items={tabs} />
                <Card className="m-y-md">
                  <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                    <div className="tw-col-span-full">
                      <Description
                        isReadOnly
                        description={getDashboardDescription()}
                      />
                    </div>
                    <div className="tw-col-span-full">
                      <VersionTable
                        columnName={getPartialNameFromTableFQN(
                          dataModelFQN,
                          [FqnPart.Column],
                          FQN_SEPARATOR_CHAR
                        )}
                        columns={updatedColumns()}
                        joins={[]}
                      />
                    </div>
                  </div>
                </Card>
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
    </PageContainerV1>
  );
};

export default DataModelVersion;
