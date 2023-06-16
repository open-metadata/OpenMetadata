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
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import VersionTable from 'components/VersionTable/VersionTable.component';
import { EntityTabs, FqnPart } from 'enums/entity.enum';
import {
  ChangeDescription,
  Column,
  DashboardDataModel,
} from 'generated/entity/data/dashboardDataModel';
import { EntityDiffProps } from 'interface/EntityVersion.interface';
import { cloneDeep, isEqual } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPartialNameFromTableFQN } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getChangedEntityName,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getCommonExtraInfoForVersionDetails,
  getDescriptionDiff,
  getDiffByFieldName,
  getEntityVersionDescription,
  getEntityVersionTags,
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
  const extraInfo = useMemo(
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
          i.description = getDescriptionDiff(
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
            i.description = getDescriptionDiff('', col.description ?? '');
            i.dataTypeDisplay = getDescriptionDiff(
              '',
              col.dataTypeDisplay ?? ''
            );
            i.name = getDescriptionDiff('', col.name);
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
      description: getDescriptionDiff(col.description ?? '', ''),
      dataTypeDisplay: getDescriptionDiff(col.dataTypeDisplay ?? '', ''),
      name: getDescriptionDiff(col.name, ''),
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
    const changedColName = getChangeColName(getChangedEntityName(columnsDiff));

    if (
      isEndsWithField(
        getChangedEntityName(columnsDiff),
        EntityField.DESCRIPTION
      )
    ) {
      handleColumnDescriptionChangeDiff(colList, columnsDiff, changedColName);

      return colList;
    } else if (isEndsWithField(getChangedEntityName(columnsDiff), 'tags')) {
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

  const tags = useMemo(() => {
    return getEntityVersionTags(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  const description = useMemo(() => {
    return getEntityVersionDescription(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  return (
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
              extraInfo={extraInfo}
              followersList={[]}
              serviceType={currentVersionData.serviceType ?? ''}
              tags={tags}
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
                    <Description isReadOnly description={description} />
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
  );
};

export default DataModelVersion;
