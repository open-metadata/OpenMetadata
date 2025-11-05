/*
 *  Copyright 2025 Collate.
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
import { Button, Col, Row, Skeleton, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-delete.svg';
import DateTimeDisplay from '../../components/common/DateTimeDisplay/DateTimeDisplay';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
} from '../../constants/constants';
import { ALERTS_DOCS } from '../../constants/docs.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import {
  NotificationTemplate,
  ProviderType,
} from '../../generated/entity/events/notificationTemplate';
import { Paging } from '../../generated/type/paging';
import LimitWrapper from '../../hoc/LimitWrapper';
import { usePaging } from '../../hooks/paging/usePaging';
import { getAllNotificationTemplates } from '../../rest/notificationtemplateAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const NotificationTemplatesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingCount, setLoadingCount] = useState(0);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<NotificationTemplate>();
  const {
    pageSize,
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
    paging,
  } = usePaging();
  const { getResourceLimit } = useLimitStore();
  const { getEntityPermissionByFqn, getResourcePermission } =
    usePermissionProvider();
  const [templatePermissions, setTemplatePermissions] = useState<
    {
      id: string;
      edit: boolean;
      delete: boolean;
    }[]
  >();
  const [templateResourcePermission, setTemplateResourcePermission] =
    useState<OperationPermission>();

  const fetchTemplatePermissionByFqn = async (
    templateDetails: NotificationTemplate
  ) => {
    const permission = await getEntityPermissionByFqn(
      ResourceEntity.NOTIFICATION_TEMPLATE,
      templateDetails.fullyQualifiedName ?? ''
    );

    const editPermission = permission.EditAll;
    const deletePermission = permission.Delete;

    return {
      id: templateDetails.id,
      edit: editPermission,
      delete: deletePermission,
    };
  };

  const fetchTemplateResourcePermission = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const permission = await getResourcePermission(
        ResourceEntity.NOTIFICATION_TEMPLATE
      );

      setTemplateResourcePermission(permission);
    } catch {
      // Error
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  const fetchAllTemplatesPermission = async (
    templates: NotificationTemplate[]
  ) => {
    try {
      setLoadingCount((count) => count + 1);
      const response = templates.map((template) =>
        fetchTemplatePermissionByFqn(template)
      );

      setTemplatePermissions(await Promise.all(response));
    } catch {
      // Error
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.NOTIFICATIONS,
        t('label.template-plural')
      ),
    []
  );

  const fetchTemplates = useCallback(
    async (params?: Partial<Paging>) => {
      setLoadingCount((count) => count + 1);
      try {
        const { data, paging } = await getAllNotificationTemplates({
          after: params?.after,
          before: params?.before,
          limit: pageSize,
        });

        setTemplates(data);

        handlePagingChange(paging);
        fetchAllTemplatesPermission(data);
      } catch {
        showErrorToast(
          t('server.entity-fetch-error', { entity: t('label.template-plural') })
        );
      } finally {
        setLoadingCount((count) => count - 1);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    fetchTemplateResourcePermission();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [pageSize]);

  const handleTemplateDelete = useCallback(async () => {
    try {
      setSelectedTemplate(undefined);
      await getResourceLimit('notificationTemplate', true, true);
      fetchTemplates();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [fetchTemplates]);

  const onPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        fetchTemplates({ [cursorType]: paging[cursorType] });
        handlePageChange(currentPage);
      }
    },
    [paging]
  );

  const columns = useMemo(
    () => [
      {
        title: t('label.name').toString(),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_: string, record: NotificationTemplate) => {
          return (
            record.fullyQualifiedName && (
              <Link data-testid="template-name" to="">
                {getEntityName(record)}
              </Link>
            )
          );
        },
      },
      {
        title: t('label.trigger').toString(),
        dataIndex: 'updatedAt',
        width: '200px',
        key: 'updatedAt',
        render: (updatedAt: number) => (
          <DateTimeDisplay timestamp={updatedAt} />
        ),
      },
      {
        title: t('label.action-plural').toString(),
        dataIndex: 'fullyQualifiedName',
        width: 90,
        key: 'fullyQualifiedName',
        render: (_: string, record: NotificationTemplate) => {
          const templatePermission = templatePermissions?.find(
            (template) => template.id === record.id
          );
          if (loadingCount > 0) {
            return <Skeleton active className="p-r-lg" paragraph={false} />;
          }

          if (
            isUndefined(templatePermission) ||
            (!templatePermission.edit && !templatePermission.delete)
          ) {
            return (
              <Typography.Text className="p-l-xs">
                {NO_DATA_PLACEHOLDER}
              </Typography.Text>
            );
          }

          return (
            <div className="d-flex items-center">
              {templatePermission.edit && (
                <Tooltip placement="bottom" title={t('label.edit')}>
                  <Link to="">
                    <Button
                      className="flex flex-center"
                      data-testid={`template-edit-${record.name}`}
                      disabled={record.provider === ProviderType.System}
                      icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                      type="text"
                    />
                  </Link>
                </Tooltip>
              )}
              {templatePermission.delete && (
                <Tooltip placement="bottom" title={t('label.delete')}>
                  <Button
                    className="flex flex-center"
                    data-testid={`template-delete-${record.name}`}
                    disabled={record.provider === ProviderType.System}
                    icon={<DeleteIcon height={16} />}
                    type="text"
                    onClick={() => setSelectedTemplate(record)}
                  />
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [templatePermissions, loadingCount]
  );

  return (
    <PageLayoutV1 pageTitle={t('label.template-plural')}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <div className="d-flex justify-between">
            <PageHeader data={PAGE_HEADERS.NOTIFICATION} />
            {(templateResourcePermission?.Create ||
              templateResourcePermission?.All) && (
              <LimitWrapper resource="eventsubscription">
                <Button
                  data-testid="create-notification"
                  type="primary"
                  onClick={() =>
                    navigate(
                      getSettingPath(
                        GlobalSettingsMenuCategory.NOTIFICATIONS,
                        GlobalSettingOptions.ADD_NOTIFICATION
                      )
                    )
                  }>
                  {t('label.add-entity', { entity: t('label.template') })}
                </Button>
              </LimitWrapper>
            )}
          </div>
        </Col>
        <Col span={24}>
          <Table
            columns={columns}
            customPaginationProps={{
              currentPage,
              isLoading: loadingCount > 0,
              showPagination,
              pageSize,
              paging,
              pagingHandler: onPageChange,
              onShowSizeChange: handlePageSizeChange,
            }}
            dataSource={templates}
            loading={Boolean(loadingCount)}
            locale={{
              emptyText: (
                <ErrorPlaceHolder
                  permission
                  className="p-y-md"
                  doc={ALERTS_DOCS}
                  heading={t('label.template')}
                  permissionValue={t('label.create-entity', {
                    entity: t('label.template'),
                  })}
                  type={ERROR_PLACEHOLDER_TYPE.CREATE}
                  onClick={() =>
                    navigate(
                      getSettingPath(
                        GlobalSettingsMenuCategory.NOTIFICATIONS,
                        GlobalSettingOptions.ADD_NOTIFICATION
                      )
                    )
                  }
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </Col>
        <Col span={24}>
          <DeleteWidgetModal
            afterDeleteAction={handleTemplateDelete}
            allowSoftDelete={false}
            entityId={selectedTemplate?.id ?? ''}
            entityName={getEntityName(selectedTemplate)}
            entityType={EntityType.SUBSCRIPTION}
            visible={Boolean(selectedTemplate)}
            onCancel={() => {
              setSelectedTemplate(undefined);
            }}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default NotificationTemplatesPage;
