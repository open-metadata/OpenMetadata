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
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { getVersionPathWithTab } from 'constants/constants';
import { EntityInfo, EntityTabs, EntityType } from 'enums/entity.enum';
import { t } from 'i18next';
import { EntityDiffProps } from 'interface/EntityVersion.interface';
import { cloneDeep, isEqual } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import {
  ChangeDescription,
  Pipeline,
  Task,
} from '../../generated/entity/data/pipeline';
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
} from '../../utils/EntityVersionUtils';
import { TagLabelWithStatus } from '../../utils/EntityVersionUtils.interface';
import SVGIcons from '../../utils/SvgUtils';
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
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const getChangeColName = (name: string | undefined) => {
    return name?.split(FQN_SEPARATOR_CHAR)?.slice(-2, -1)[0];
  };

  const isEndsWithField = (name: string | undefined, checkWith: string) => {
    return name?.endsWith(checkWith);
  };

  const extraInfo = useMemo(() => {
    const { sourceUrl, serviceType, displayName, name } =
      currentVersionData as Pipeline;

    return [
      ...getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
      ...(sourceUrl
        ? [
            {
              key: `${serviceType} ${EntityInfo.URL}`,
              value: sourceUrl,
              placeholderText: displayName ?? name,
              isLink: true,
              openInNewTab: true,
            },
          ]
        : []),
    ];
  }, [currentVersionData, changeDescription, owner, tier]);

  const handleColumnDescriptionChangeDiff = (
    colList: Pipeline['tasks'],
    columnsDiff: EntityDiffProps,
    changedColName: string | undefined
  ) => {
    const oldDescription = getChangedEntityOldValue(columnsDiff);
    const newDescription = getChangedEntityNewValue(columnsDiff);

    const formatColumnData = (arr: Pipeline['tasks']) => {
      arr?.forEach((i) => {
        if (isEqual(i.name, changedColName)) {
          i.description = getTextDiff(
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
    columnsDiff: EntityDiffProps,
    changedColName: string | undefined
  ) => {
    const oldTags: Array<TagLabel> = JSON.parse(
      getChangedEntityOldValue(columnsDiff) ?? '[]'
    );
    const newTags: Array<TagLabel> = JSON.parse(
      getChangedEntityNewValue(columnsDiff) ?? '[]'
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
    columnsDiff: EntityDiffProps
  ) => {
    const newCol: Pipeline['tasks'] = JSON.parse(
      columnsDiff.added?.newValue ?? '[]'
    );
    newCol?.forEach((col) => {
      const formatColumnData = (arr: Pipeline['tasks']) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, col.name)) {
            i.tags = col.tags?.map((tag) => ({ ...tag, added: true }));
            i.description = getTextDiff('', col.description ?? '');
            i.taskType = getTextDiff('', col.taskType ?? '');
            i.name = getTextDiff('', col.name);
          }
        });
      };
      formatColumnData(colList);
    });
  };

  const handleColumnDiffDeleted = (columnsDiff: EntityDiffProps) => {
    const newCol: Pipeline['tasks'] = JSON.parse(
      columnsDiff.deleted?.oldValue ?? '[]'
    );

    return newCol?.map((col) => ({
      ...col,
      tags: col.tags?.map((tag) => ({ ...tag, removed: true })),
      description: getTextDiff(col.description ?? '', ''),
      taskType: getTextDiff(col.taskType ?? '', ''),
      name: getTextDiff(col.name, ''),
    }));
  };

  const pipelineVersionTableData = useMemo((): Pipeline['tasks'] => {
    const colList = cloneDeep((currentVersionData as Pipeline).tasks ?? []);
    const columnsDiff = getDiffByFieldName(
      EntityField.TASKS,
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
    } else if (
      isEndsWithField(getChangedEntityName(columnsDiff), EntityField.TAGS)
    ) {
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

  const handleTabChange = (activeKey: string) => {
    history.push(
      getVersionPathWithTab(
        EntityType.PIPELINE,
        currentVersionData.fullyQualifiedName ?? '',
        String(version),
        activeKey
      )
    );
  };

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

  const tags = useMemo(() => {
    return getEntityVersionTags(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  const description = useMemo(() => {
    return getEntityVersionByField(
      currentVersionData,
      changeDescription,
      EntityField.DESCRIPTION
    );
  }, [currentVersionData, changeDescription]);

  const displayName = useMemo(() => {
    return getEntityVersionByField(
      currentVersionData,
      changeDescription,
      EntityField.DISPLAYNAME
    );
  }, [currentVersionData, changeDescription]);

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')}>
          <EntityPageInfo
            isVersionSelected
            deleted={deleted}
            displayName={displayName}
            entityName={
              currentVersionData.displayName ?? currentVersionData.name ?? ''
            }
            extraInfo={extraInfo}
            followersList={[]}
            serviceType={currentVersionData.serviceType ?? ''}
            tags={tags}
            tier={{} as TagLabel}
            titleLinks={slashedPipelineName}
            version={Number(version)}
            versionHandler={backHandler}
          />
          <div className="tw-mt-1 d-flex flex-col flex-grow ">
            <Tabs
              defaultActiveKey={tab ?? EntityTabs.TASKS}
              onChange={handleTabChange}>
              <Tabs.TabPane
                key={EntityTabs.TASKS}
                tab={
                  <TabsLabel
                    id={EntityTabs.TASKS}
                    name={t('label.task-plural')}
                  />
                }>
                <Card className="m-y-md">
                  <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                    <div className="tw-col-span-full">
                      <Description isReadOnly description={description} />
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
                  entityType={EntityType.PIPELINE}
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
    </PageLayoutV1>
  );
};

export default PipelineVersion;
