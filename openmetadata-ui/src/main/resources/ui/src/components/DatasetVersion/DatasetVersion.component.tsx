/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { cloneDeep, isEqual, isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { useEffect, useState } from 'react';
import {
  ChangeDescription,
  Column,
  ColumnJoins,
  Table,
} from '../../generated/entity/data/table';
import { TagLabel } from '../../generated/type/tagLabel';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import {
  getDescriptionDiff,
  getDiffByFieldName,
  getDiffValue,
  getTagsDiff,
} from '../../utils/EntityVersionUtils';
import { getOwnerFromId } from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import SchemaTab from '../SchemaTab/SchemaTab.component';
import { DatasetVersionProp } from './DatasetVersion.interface';

const DatasetVersion: React.FC<DatasetVersionProp> = ({
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
}: DatasetVersionProp) => {
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const getChangeColName = (name: string | undefined) => {
    return name?.split('.')?.slice(-2, -1)[0];
  };

  const isEndsWithField = (name: string | undefined, checkWith: string) => {
    return name?.endsWith(checkWith);
  };

  const getExtraInfo = () => {
    const ownerDiff = getDiffByFieldName('owner', changeDescription);

    const oldOwner = getOwnerFromId(
      JSON.parse(
        ownerDiff?.added?.oldValue ??
          ownerDiff?.deleted?.oldValue ??
          ownerDiff?.updated?.oldValue ??
          '{}'
      )?.id
    );
    const newOwner = getOwnerFromId(
      JSON.parse(
        ownerDiff?.added?.newValue ??
          ownerDiff?.deleted?.newValue ??
          ownerDiff?.updated?.newValue ??
          '{}'
      )?.id
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
          !isUndefined(ownerDiff.added) ||
          !isUndefined(ownerDiff.deleted) ||
          !isUndefined(ownerDiff.updated)
            ? getDiffValue(
                oldOwner?.displayName || oldOwner?.name || '',
                newOwner?.displayName || newOwner?.name || ''
              )
            : ownerPlaceHolder
            ? getDiffValue(ownerPlaceHolder, ownerPlaceHolder)
            : '',
      },
      {
        key: 'Tier',
        value:
          !isUndefined(newTier) || !isUndefined(oldTier)
            ? getDiffValue(
                oldTier?.tagFQN?.split('.')[1] || '',
                newTier?.tagFQN?.split('.')[1] || ''
              )
            : tier?.tagFQN
            ? tier?.tagFQN.split('.')[1]
            : '',
      },
    ];

    return extraInfo;
  };

  const getTableDescription = () => {
    const descriptionDiff = getDiffByFieldName(
      'description',
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

  const updatedColumns = (): Table['columns'] => {
    const colList = cloneDeep(currentVersionData.columns);
    const columnsDiff = getDiffByFieldName('columns', changeDescription);
    const changedColName = getChangeColName(
      columnsDiff?.added?.name ??
        columnsDiff?.deleted?.name ??
        columnsDiff?.updated?.name
    );

    if (
      isEndsWithField(
        columnsDiff?.added?.name ??
          columnsDiff?.deleted?.name ??
          columnsDiff?.updated?.name,
        'description'
      )
    ) {
      const oldDescription =
        columnsDiff?.added?.oldValue ??
        columnsDiff?.deleted?.oldValue ??
        columnsDiff?.updated?.oldValue;
      const newDescription =
        columnsDiff?.added?.newValue ??
        columnsDiff?.deleted?.newValue ??
        columnsDiff?.updated?.newValue;

      const formatColumnData = (arr: Table['columns']) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, changedColName)) {
            i.description = getDescriptionDiff(
              oldDescription,
              newDescription,
              i.description
            );
          } else {
            formatColumnData(i?.children as Table['columns']);
          }
        });
      };

      formatColumnData(colList ?? []);

      return colList ?? [];
    } else if (
      isEndsWithField(
        columnsDiff?.added?.name ??
          columnsDiff?.deleted?.name ??
          columnsDiff?.updated?.name,
        'tags'
      )
    ) {
      const oldTags: Array<TagLabel> = JSON.parse(
        columnsDiff?.added?.oldValue ??
          columnsDiff?.deleted?.oldValue ??
          columnsDiff?.updated?.oldValue ??
          '[]'
      );
      const newTags: Array<TagLabel> = JSON.parse(
        columnsDiff?.added?.newValue ??
          columnsDiff?.deleted?.newValue ??
          columnsDiff?.updated?.newValue ??
          '[]'
      );

      const formatColumnData = (arr: Table['columns']) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, changedColName)) {
            const flag: { [x: string]: boolean } = {};
            const uniqueTags: Array<
              TagLabel & { added: boolean; removed: boolean }
            > = [];
            const tagsDiff = getTagsDiff(oldTags, newTags);
            [...tagsDiff, ...(i.tags as Array<TagLabel>)].forEach(
              (elem: TagLabel & { added: boolean; removed: boolean }) => {
                if (!flag[elem.tagFQN as string]) {
                  flag[elem.tagFQN as string] = true;
                  uniqueTags.push(elem);
                }
              }
            );
            i.tags = uniqueTags;
          } else {
            formatColumnData(i?.children as Table['columns']);
          }
        });
      };

      formatColumnData(colList ?? []);

      return colList ?? [];
    } else {
      const columnsDiff = getDiffByFieldName(
        'columns',
        changeDescription,
        true
      );
      let newColumns: Array<Column> = [] as Array<Column>;
      if (columnsDiff.added) {
        const newCol: Array<Column> = JSON.parse(
          columnsDiff.added?.newValue ?? '[]'
        );
        newCol.forEach((col) => {
          const formatColumnData = (arr: Table['columns']) => {
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
                formatColumnData(i?.children as Table['columns']);
              }
            });
          };
          formatColumnData(colList ?? []);
        });
      }
      if (columnsDiff.deleted) {
        const newCol: Array<Column> = JSON.parse(
          columnsDiff.deleted?.oldValue ?? '[]'
        );
        newColumns = newCol.map((col) => ({
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
      } else {
        return colList ?? [];
      }

      return [...newColumns, ...(colList ?? [])];
    }
  };

  const tabs = [
    {
      name: 'Schema',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 1,
    },
  ];

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  return (
    <PageContainer>
      <div
        className={classNames(
          'tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col tw-relative'
        )}>
        {isVersionLoading ? (
          <Loader />
        ) : (
          <div className={classNames('version-data')}>
            <EntityPageInfo
              isVersionSelected
              deleted={deleted}
              entityName={currentVersionData.name ?? ''}
              extraInfo={getExtraInfo()}
              followersList={[]}
              tags={getTableTags(currentVersionData.columns || [])}
              tier={tier}
              titleLinks={slashedTableName}
              version={version}
              versionHandler={backHandler}
            />
            <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow ">
              <TabsPane activeTab={1} className="tw-flex-initial" tabs={tabs} />
              <div className="tw-bg-white tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
                <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                  <div className="tw-col-span-full">
                    <Description
                      isReadOnly
                      description={getTableDescription()}
                    />
                  </div>

                  <div className="tw-col-span-full">
                    <SchemaTab
                      isReadOnly
                      columnName={getPartialNameFromFQN(
                        datasetFQN,
                        ['column'],
                        '.'
                      )}
                      columns={updatedColumns()}
                      joins={currentVersionData.joins as ColumnJoins[]}
                    />
                  </div>
                </div>
              </div>
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
    </PageContainer>
  );
};

export default DatasetVersion;
