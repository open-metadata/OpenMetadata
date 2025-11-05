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
import { Button, Grid } from '@mui/material';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFormDrawerWithRef } from '../../components/common/atoms/drawer';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import NotificationTemplateForm from '../../components/NotificationTemplate/NotificationTemplateForm/NotificationTemplateForm';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
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
import { NotificationTemplate } from '../../generated/entity/events/notificationTemplate';
import { Paging } from '../../generated/type/paging';
import LimitWrapper from '../../hoc/LimitWrapper';
import { usePaging } from '../../hooks/paging/usePaging';
import { getAllNotificationTemplates } from '../../rest/notificationtemplateAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import {
  getNotificationTemplateListColumns,
  TemplatePermissionInfo,
} from '../../utils/NotificationTemplateUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const NotificationTemplatesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingCount, setLoadingCount] = useState(0);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<NotificationTemplate>();
  const [form] = useForm();
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
  const [templatePermissions, setTemplatePermissions] =
    useState<TemplatePermissionInfo[]>();
  const [templateResourcePermission, setTemplateResourcePermission] =
    useState<OperationPermission>();

  const { formDrawer, openDrawer } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.template') }),
    anchor: 'right',
    width: 670,
    closeOnEscape: false,
    onCancel: () => {
      form.resetFields();
    },
    form: <NotificationTemplateForm />,
    formRef: form,
    onSubmit: () => {
      // This is called by the drawer button, but actual submission
      // happens via formRef.submit() which triggers form.onFinish
    },
    loading: loadingCount > 0,
  });

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
    () =>
      getNotificationTemplateListColumns(
        templatePermissions || [],
        loadingCount,
        (record: NotificationTemplate) => setSelectedTemplate(record)
      ),
    [templatePermissions, loadingCount]
  );

  useEffect(() => {
    fetchTemplateResourcePermission();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [pageSize]);

  return (
    <PageLayoutV1 pageTitle={t('label.template-plural')}>
      <Grid container spacing={2}>
        <Grid size={12}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Grid>
        <Grid
          container
          alignItems="center"
          justifyContent="space-between"
          size={12}>
          <Grid>
            <PageHeader data={PAGE_HEADERS.NOTIFICATION} />
          </Grid>
          <Grid>
            {(templateResourcePermission?.Create ||
              templateResourcePermission?.All) && (
              <LimitWrapper resource="eventsubscription">
                <Button
                  data-testid="create-notification"
                  variant="contained"
                  onClick={openDrawer}>
                  {t('label.add-entity', { entity: t('label.template') })}
                </Button>
              </LimitWrapper>
            )}
          </Grid>
        </Grid>
        <Grid size={12}>
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
        </Grid>
        <Grid size={12}>
          <DeleteWidgetModal
            afterDeleteAction={handleTemplateDelete}
            allowSoftDelete={false}
            entityId={selectedTemplate?.id ?? ''}
            entityName={getEntityName(selectedTemplate)}
            entityType={EntityType.NOTIFICATION_TEMPLATE}
            visible={Boolean(selectedTemplate)}
            onCancel={() => {
              setSelectedTemplate(undefined);
            }}
          />
        </Grid>
      </Grid>
      {formDrawer}
    </PageLayoutV1>
  );
};

export default NotificationTemplatesPage;
