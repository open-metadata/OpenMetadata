/*
 *  Copyright 2023 Collate.
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

import { Col, Row, Space, Switch, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import TagsViewer from 'components/Tag/TagsViewer/TagsViewer';
import { DisplayType } from 'components/Tag/TagsViewer/TagsViewer.interface';
import { NO_DATA_PLACEHOLDER, PAGE_SIZE } from 'constants/constants';
import { ServiceCategory } from 'enums/service.enum';
import { Database } from 'generated/entity/data/database';
import { Pipeline } from 'generated/entity/data/pipeline';
import { Paging } from 'generated/type/paging';
import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import { ServicesType } from 'interface/service.interface';
import { isEmpty, isNil, isUndefined } from 'lodash';
import { EntityTags, ServiceTypes } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import {
  getEntityTypeFromServiceCategory,
  getLinkForFqn,
} from 'utils/ServiceUtils';
import {
  getTagsWithoutTier,
  getTierTags,
  getUsagePercentile,
} from 'utils/TableUtils';
import { ServicePageData } from './ServiceDetailsPage';

interface ServiceMainTabContentProps {
  serviceName: string;
  servicePermission: OperationPermission;
  serviceDetails: ServicesType;
  onDescriptionUpdate: (updatedHTML: string) => Promise<void>;
  showDeleted: boolean;
  onShowDeletedChange: (value: boolean) => void;
  data: ServicePageData[];
  isServiceLoading: boolean;
  paging: Paging;
  currentPage: number;
  pagingHandler: (cursorType: string | number, activePage?: number) => void;
  saveUpdatedServiceData: (updatedData: ServicesType) => Promise<void>;
}

const tableComponent = {
  body: {
    row: ({ children }: { children: React.ReactNode }) => (
      <tr data-testid="row">{children}</tr>
    ),
  },
};

function ServiceMainTabContent({
  serviceName,
  servicePermission,
  onDescriptionUpdate,
  showDeleted,
  onShowDeletedChange,
  data,
  isServiceLoading,
  paging,
  pagingHandler,
  currentPage,
  serviceDetails,
  saveUpdatedServiceData,
}: ServiceMainTabContentProps) {
  const { t } = useTranslation();
  const { serviceFQN, serviceCategory } = useParams<{
    serviceFQN: string;
    serviceCategory: ServiceTypes;
  }>();
  const [isEdit, setIsEdit] = useState(false);

  const tier = getTierTags(serviceDetails?.tags ?? []);
  const tags = getTagsWithoutTier(serviceDetails?.tags ?? []);

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const onTagUpdate = async (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...serviceDetails, tags: updatedTags };
      await saveUpdatedServiceData(updatedTable);
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    if (selectedTags) {
      const prevTags =
        tags?.filter((tag) =>
          selectedTags
            .map((selTag) => selTag.tagFQN)
            .includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags
            ?.map((prevTag) => prevTag.tagFQN)
            .includes(tag.tagFQN);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: tag.source,
          tagFQN: tag.tagFQN,
        }));
      await onTagUpdate([...prevTags, ...newTags]);
    }
  };

  const handleDescriptionUpdate = useCallback(async (updatedHTML: string) => {
    try {
      await onDescriptionUpdate(updatedHTML);
    } catch (e) {
      // Error
    } finally {
      setIsEdit(false);
    }
  }, []);

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const tableColumn: ColumnsType<ServicePageData> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'displayName',
        key: 'displayName',
        render: (_, record: ServicePageData) => {
          return (
            <Link
              to={getLinkForFqn(
                serviceCategory,
                record.fullyQualifiedName ?? ''
              )}>
              {getEntityName(record)}
            </Link>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: ServicePageData['description']) =>
          !isUndefined(description) && description.trim() ? (
            <RichTextEditorPreviewer markdown={description} />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          ),
      },
      ...(ServiceCategory.PIPELINE_SERVICES === serviceCategory
        ? [
            {
              title: t('label.schedule-interval'),
              dataIndex: 'scheduleInterval',
              key: 'scheduleInterval',
              render: (scheduleInterval: Pipeline['scheduleInterval']) =>
                scheduleInterval ? (
                  <span>{scheduleInterval}</span>
                ) : (
                  <Typography.Text>{NO_DATA_PLACEHOLDER}</Typography.Text>
                ),
            },
          ]
        : []),
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        render: (owner: ServicePageData['owner']) =>
          !isUndefined(owner) ? (
            <Space data-testid="owner-data">
              <ProfilePicture
                id=""
                name={owner.name ?? ''}
                type="circle"
                width="24"
              />
              <Typography.Text data-testid={`${owner.name}-owner-name`}>
                {getEntityName(owner)}
              </Typography.Text>
            </Space>
          ) : (
            <Typography.Text data-testid="no-owner-text">--</Typography.Text>
          ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        width: 200,
        key: 'tags',
        render: (_, record: ServicePageData) => (
          <TagsViewer tags={record.tags ?? []} />
        ),
      },
      ...(ServiceCategory.DATABASE_SERVICES === serviceCategory
        ? [
            {
              title: t('label.usage'),
              dataIndex: 'usageSummary',
              key: 'usageSummary',
              render: (usageSummary: Database['usageSummary']) => (
                <Typography.Text>
                  {getUsagePercentile(
                    usageSummary?.weeklyStats?.percentileRank ?? 0
                  )}
                </Typography.Text>
              ),
            },
          ]
        : []),
    ];
  }, [serviceCategory]);
  const entityType = useMemo(
    () => getEntityTypeFromServiceCategory(serviceCategory),
    [serviceCategory]
  );

  const editTagsPermission = useMemo(
    () => servicePermission.EditTags || servicePermission.EditAll,
    [servicePermission, serviceDetails]
  );

  return (
    <Row gutter={[0, 16]} wrap={false}>
      <Col className="p-t-sm m-x-lg" flex="auto">
        <Row gutter={[16, 16]}>
          <Col data-testid="description-container" span={24}>
            <DescriptionV1
              description={serviceDetails.description}
              entityFqn={serviceFQN}
              entityName={serviceName}
              entityType={entityType}
              hasEditAccess={
                servicePermission.EditDescription || servicePermission.EditAll
              }
              isEdit={isEdit}
              showCommentsIcon={false}
              onCancel={onCancel}
              onDescriptionEdit={onDescriptionEdit}
              onDescriptionUpdate={handleDescriptionUpdate}
            />
          </Col>
          <Col span={24}>
            <Row justify="end">
              <Col>
                <Switch
                  checked={showDeleted}
                  data-testid="show-deleted"
                  onClick={onShowDeletedChange}
                />
                <Typography.Text className="m-l-xs">
                  {t('label.deleted')}
                </Typography.Text>{' '}
              </Col>
            </Row>
          </Col>
          <Col data-testid="table-container" span={24}>
            <Table
              bordered
              columns={tableColumn}
              components={tableComponent}
              data-testid="service-children-table"
              dataSource={data}
              loading={{
                spinning: isServiceLoading,
                indicator: <Loader size="small" />,
              }}
              locale={{
                emptyText: <ErrorPlaceHolder className="m-y-md" />,
              }}
              pagination={false}
              rowKey="id"
              size="small"
            />
            {Boolean(!isNil(paging.after) || !isNil(paging.before)) &&
              !isEmpty(data) && (
                <NextPrevious
                  currentPage={currentPage}
                  pageSize={PAGE_SIZE}
                  paging={paging}
                  pagingHandler={pagingHandler}
                  totalCount={paging.total}
                />
              )}
          </Col>
        </Row>
      </Col>
      <Col
        className="entity-tag-right-panel-container"
        data-testid="entity-right-panel"
        flex="320px">
        <Space className="w-full" direction="vertical" size="large">
          <TagsContainerV2
            displayType={DisplayType.READ_MORE}
            entityFqn={serviceFQN}
            entityType={entityType}
            permission={editTagsPermission}
            selectedTags={tags}
            showTaskHandler={false}
            tagType={TagSource.Classification}
            onSelectionChange={handleTagSelection}
          />
          <TagsContainerV2
            displayType={DisplayType.READ_MORE}
            entityFqn={serviceFQN}
            entityType={entityType}
            permission={editTagsPermission}
            selectedTags={tags}
            showTaskHandler={false}
            tagType={TagSource.Glossary}
            onSelectionChange={handleTagSelection}
          />
        </Space>
      </Col>
    </Row>
  );
}

export default ServiceMainTabContent;
