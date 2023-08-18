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

import { Col, Row, Space, Table, Tabs, TabsProps } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as IconExternalLink } from 'assets/svg/external-links.svg';
import classNames from 'classnames';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import DataAssetsVersionHeader from 'components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import EntityVersionTimeLine from 'components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from 'components/Loader/Loader';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import TagsViewer from 'components/Tag/TagsViewer/TagsViewer';
import { getVersionPathWithTab } from 'constants/constants';
import { TABLE_SCROLL_VALUE } from 'constants/Table.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityTabs, EntityType } from 'enums/entity.enum';
import { TagSource } from 'generated/type/schema';
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
  entityPermissions,
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

  const { ownerDisplayName, ownerRef, tierDisplayName } = useMemo(
    () => getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
    [changeDescription, owner, tier]
  );

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
          <TagsViewer sizeCap={-1} tags={getFilterTags(tags || []).Glossary} />
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
        key: EntityTabs.TASKS,
        label: (
          <TabsLabel id={EntityTabs.TASKS} name={t('label.task-plural')} />
        ),
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    isVersionView
                    description={description}
                    entityType={EntityType.PIPELINE}
                  />
                </Col>
                <Col span={24}>
                  <Table
                    bordered
                    columns={tableColumn}
                    data-testid="schema-table"
                    dataSource={pipelineVersionTableData}
                    pagination={false}
                    rowKey="name"
                    scroll={TABLE_SCROLL_VALUE}
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
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    entityFqn={currentVersionData.fullyQualifiedName}
                    entityType={EntityType.PIPELINE}
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
            entityType={EntityType.PIPELINE}
            hasEditAccess={false}
          />
        ),
      },
    ],
    [
      description,
      tableColumn,
      pipelineVersionTableData,
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
                breadcrumbLinks={slashedPipelineName}
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
                defaultActiveKey={tab ?? EntityTabs.TASKS}
                items={tabItems}
                onChange={handleTabChange}
              />
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
    </>
  );
};

export default PipelineVersion;
