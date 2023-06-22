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
import { ReactComponent as IconExternalLink } from 'assets/svg/external-links.svg';
import classNames from 'classnames';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { EntityTabs } from 'enums/entity.enum';
import { t } from 'i18next';
import { ColumnDiffProps } from 'interface/EntityVersion.interface';
import { cloneDeep, isEqual, isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { OwnerType } from '../../enums/user.enum';
import {
  ChangeDescription,
  Pipeline,
  Task,
} from '../../generated/entity/data/pipeline';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getColumnDiffNewValue,
  getColumnDiffOldValue,
  getColumnDiffValue,
  getDescriptionDiff,
  getDiffByFieldName,
  getDiffValue,
  getTagsDiff,
} from '../../utils/EntityVersionUtils';
import { TagLabelWithStatus } from '../../utils/EntityVersionUtils.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import { PipelineVersionProp } from './PipelineVersion.interface';

const PipelineVersion: FC<PipelineVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedPipelineName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
}: PipelineVersionProp) => {
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const getChangeColName = (name: string | undefined) => {
    return name?.split(FQN_SEPARATOR_CHAR)?.slice(-2, -1)[0];
  };

  const isEndsWithField = (name: string | undefined, checkWith: string) => {
    return name?.endsWith(checkWith);
  };

  const tabs = [
    {
      label: t('label.task-plural'),
      key: EntityTabs.TASKS,
    },
  ];

  const getPipelineDescription = () => {
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
        key: t('label.owner'),
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
        profileName:
          newOwner?.type === OwnerType.USER ? newOwner?.name : undefined,
      },
      {
        key: t('label.tier'),
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
      {
        key: `${currentVersionData.serviceType} Url`,
        value: (currentVersionData as Pipeline).sourceUrl,
        placeholderText:
          currentVersionData.displayName ?? currentVersionData.name,
        isLink: true,
        openInNewTab: true,
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

  const handleColumnDescriptionChangeDiff = (
    colList: Pipeline['tasks'],
    columnsDiff: ColumnDiffProps,
    changedColName: string | undefined
  ) => {
    const oldDescription = getColumnDiffOldValue(columnsDiff);
    const newDescription = getColumnDiffNewValue(columnsDiff);

    const formatColumnData = (arr: Pipeline['tasks']) => {
      arr?.forEach((i) => {
        if (isEqual(i.name, changedColName)) {
          i.description = getDescriptionDiff(
            oldDescription,
            newDescription,
            i.description
          );
        }
      });
    };

    formatColumnData(colList);
  };

  const handleColumnTagChangeDiff = (
    colList: Pipeline['tasks'],
    columnsDiff: ColumnDiffProps,
    changedColName: string | undefined
  ) => {
    const oldTags: Array<TagLabel> = JSON.parse(
      getColumnDiffOldValue(columnsDiff) ?? '[]'
    );
    const newTags: Array<TagLabel> = JSON.parse(
      getColumnDiffNewValue(columnsDiff) ?? '[]'
    );

    const formatColumnData = (arr: Pipeline['tasks']) => {
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
        }
      });
    };

    formatColumnData(colList);
  };

  const handleColumnDiffAdded = (
    colList: Pipeline['tasks'],
    columnsDiff: ColumnDiffProps
  ) => {
    const newCol: Pipeline['tasks'] = JSON.parse(
      columnsDiff.added?.newValue ?? '[]'
    );
    newCol?.forEach((col) => {
      const formatColumnData = (arr: Pipeline['tasks']) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, col.name)) {
            i.tags = col.tags?.map((tag) => ({ ...tag, added: true }));
            i.description = getDescriptionDiff(
              undefined,
              col.description,
              col.description
            );
            i.taskType = getDescriptionDiff(
              undefined,
              col.taskType,
              col.taskType
            );
            i.name = getDescriptionDiff(undefined, col.name, col.name);
          }
        });
      };
      formatColumnData(colList);
    });
  };

  const handleColumnDiffDeleted = (columnsDiff: ColumnDiffProps) => {
    const newCol: Pipeline['tasks'] = JSON.parse(
      columnsDiff.deleted?.oldValue ?? '[]'
    );

    return newCol?.map((col) => ({
      ...col,
      tags: col.tags?.map((tag) => ({ ...tag, removed: true })),
      description: getDescriptionDiff(
        col.description,
        undefined,
        col.description
      ),
      taskType: getDescriptionDiff(col.taskType, undefined, col.taskType),
      name: getDescriptionDiff(col.name, undefined, col.name),
    }));
  };

  const pipelineVersionTableData = useMemo((): Pipeline['tasks'] => {
    const colList = cloneDeep((currentVersionData as Pipeline).tasks ?? []);
    const columnsDiff = getDiffByFieldName(
      EntityField.TASKS,
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
        EntityField.TASKS,
        changeDescription,
        true
      );
      let newColumns: Pipeline['tasks'] = [];
      if (columnsDiff.added) {
        handleColumnDiffAdded(colList, columnsDiff);
      }
      if (columnsDiff.deleted) {
        newColumns = handleColumnDiffDeleted(columnsDiff);
      } else {
        return colList;
      }

      return [...(newColumns ?? []), ...colList];
    }
  }, [
    currentVersionData,
    changeDescription,
    getChangeColName,
    getColumnDiffValue,
    getDiffByFieldName,
    isEndsWithField,
    handleColumnDescriptionChangeDiff,
    handleColumnTagChangeDiff,
    handleColumnDiffAdded,
    handleColumnDiffDeleted,
  ]);

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  const tableColumn: ColumnsType<Task> = useMemo(
    () => [
      {
        title: t('label.task-entity', {
          entity: t('label.column-plural'),
        }),
        dataIndex: 'displayName',
        key: 'displayName',
        width: 250,
        render: (_, record) => (
          <Link target="_blank" to={{ pathname: record.sourceUrl }}>
            <Space>
              <span>{getEntityName(record)}</span>
              <IconExternalLink className="m-l-xs" width={16} />
            </Space>
          </Link>
        ),
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
        title: t('label.task-entity', { entity: t('label.type-lowercase') }),
        dataIndex: 'taskType',
        key: 'taskType',
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 272,
        render: (tags) => (
          <TagsViewer
            sizeCap={-1}
            tags={getFilterTags(tags || []).Classification}
            type="border"
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 272,
        render: (tags) => (
          <TagsViewer
            sizeCap={-1}
            tags={getFilterTags(tags || []).Glossary}
            type="border"
          />
        ),
      },
    ],
    []
  );

  return (
    <>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')}>
          <EntityPageInfo
            isVersionSelected
            deleted={deleted}
            displayName={currentVersionData.displayName}
            entityName={
              currentVersionData.displayName ?? currentVersionData.name ?? ''
            }
            extraInfo={getExtraInfo()}
            followersList={[]}
            serviceType={currentVersionData.serviceType ?? ''}
            tags={getTags()}
            tier={{} as TagLabel}
            titleLinks={slashedPipelineName}
            version={Number(version)}
            versionHandler={backHandler}
          />
          <div className="tw-mt-1 d-flex flex-col flex-grow ">
            <Tabs activeKey={EntityTabs.TASKS} items={tabs} />
            <Card className="m-y-md">
              <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                <div className="tw-col-span-full">
                  <Description
                    isReadOnly
                    description={getPipelineDescription()}
                  />
                </div>
                <div className="m-y-md tw-col-span-full">
                  <Table
                    bordered
                    columns={tableColumn}
                    data-testid="schema-table"
                    dataSource={pipelineVersionTableData}
                    pagination={false}
                    rowKey="name"
                    scroll={{ x: 1200 }}
                    size="small"
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
    </>
  );
};

export default PipelineVersion;
