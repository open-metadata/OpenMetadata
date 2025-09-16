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
import classNames from 'classnames';
import { FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityField } from '../../../constants/Feeds.constants';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  ChangeDescription,
  Task,
} from '../../../generated/entity/data/pipeline';
import { TagSource } from '../../../generated/type/schema';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtils';
import { t } from '../../../utils/i18next/LocalUtil';
import { getUpdatedPipelineTasks } from '../../../utils/PipelineVersionUtils';
import { getVersionPath } from '../../../utils/RouterUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import Loader from '../../common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import DataAssetsVersionHeader from '../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import { PipelineVersionProp } from './PipelineVersion.interface';

const PipelineVersion: FC<PipelineVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owners,
  domains,
  dataProducts,
  tier,
  slashedPipelineName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
  entityPermissions,
}: PipelineVersionProp) => {
  const navigate = useNavigate();
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
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

  const pipelineVersionTableData = useMemo(
    () => getUpdatedPipelineTasks(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
  );

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  const handleTabChange = (activeKey: string) => {
    navigate(
      getVersionPath(
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
        dataIndex: 'name',
        key: 'name',
        width: 250,
        render: (_, record) => (
          <RichTextEditorPreviewerV1 markdown={getEntityName(record)} />
        ),
      },
      {
        title: t('label.task-entity', { entity: t('label.type-lowercase') }),
        dataIndex: 'taskType',
        key: 'taskType',
        render: (taskType) => <RichTextEditorPreviewerV1 markdown={taskType} />,
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
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
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
          <Row className="h-full" gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    description={description}
                    entityType={EntityType.PIPELINE}
                    showActions={false}
                  />
                </Col>
                <Col span={24}>
                  <Table
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
                <DataProductsContainer
                  newLook
                  activeDomains={domains}
                  dataProducts={dataProducts ?? []}
                  hasPermission={false}
                />
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    newLook
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
        children: (
          <CustomPropertyTable
            isVersionView
            entityType={EntityType.PIPELINE}
            hasEditAccess={false}
            hasPermission={entityPermissions.ViewAll}
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
      tags,
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
                breadcrumbLinks={slashedPipelineName}
                currentVersionData={currentVersionData}
                deleted={deleted}
                displayName={displayName}
                domainDisplayName={domainDisplayName}
                entityType={EntityType.PIPELINE}
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
              type={EntityType.PIPELINE}
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
        currentVersion={version ?? ''}
        entityType={EntityType.PIPELINE}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default PipelineVersion;
