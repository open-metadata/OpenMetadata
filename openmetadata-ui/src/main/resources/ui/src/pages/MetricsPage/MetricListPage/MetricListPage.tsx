/*
 *  Copyright 2024 Collate.
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
import { Button, Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, noop } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../../components/common/Table/Table';
import TableTags from '../../../components/Database/TableTags/TableTags.component';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { Include } from '../../../generated/type/include';
import { Paging } from '../../../generated/type/paging';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getMetrics } from '../../../rest/metricsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getErrorText } from '../../../utils/StringsUtils';
import { ownerTableObject } from '../../../utils/TableColumn.util';
import { showErrorToast } from '../../../utils/ToastUtils';

const MetricListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    pageSize,
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
    paging,
  } = usePaging();

  const { getResourcePermission } = usePermissionProvider();
  const [permission, setPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  const init = async () => {
    try {
      setLoading(true);
      const permission = await getResourcePermission(ResourceEntity.METRIC);
      setPermission(permission);
      if (permission.ViewAll || permission.ViewBasic) {
        const metricResponse = await getMetrics({
          fields: [TabSpecificField.OWNERS, TabSpecificField.TAGS],
          limit: pageSize,
          include: Include.All,
        });
        setMetrics(metricResponse.data);
        handlePagingChange(metricResponse.paging);
      }
    } catch (error) {
      const errorMessage = getErrorText(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.metric-plural'),
        })
      );
      showErrorToast(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (params?: Partial<Paging>) => {
    try {
      setLoadingMore(true);
      const metricResponse = await getMetrics({
        ...params,
        fields: [TabSpecificField.OWNERS, TabSpecificField.TAGS],
        limit: pageSize,
        include: Include.All,
      });
      setMetrics(metricResponse.data);
      handlePagingChange(metricResponse.paging);
    } catch (error) {
      const errorMessage = getErrorText(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.metric-plural'),
        })
      );
      showErrorToast(errorMessage);
      setError(errorMessage);
    } finally {
      setLoadingMore(false);
    }
  };

  const onPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        fetchMetrics({ [cursorType]: paging[cursorType] });
        handlePageChange(currentPage);
      }
    },
    [paging, pageSize]
  );

  const noopWithPromise = async () => {
    noop();
  };

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_: string, record: Metric) => {
          return (
            <Link
              data-testid="metric-name"
              to={getEntityDetailsPath(
                EntityType.METRIC,
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
        flex: true,
        width: 300,
        key: 'description',
        render: (description: string) =>
          isEmpty(description) ? (
            <Typography.Text className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </Typography.Text>
          ) : (
            <RichTextEditorPreviewerNew markdown={description} />
          ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        width: 300,
        render: (tags: TagLabel[], record: Metric, index: number) => (
          <TableTags<Metric>
            isReadOnly
            entityFqn={record.fullyQualifiedName ?? ''}
            entityType={EntityType.METRIC}
            handleTagSelection={noopWithPromise}
            hasTagEditAccess={false}
            index={index}
            record={record}
            tags={tags}
            type={TagSource.Classification}
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'glossary',
        width: 300,
        render: (tags: TagLabel[], record: Metric, index: number) => (
          <TableTags<Metric>
            isReadOnly
            entityFqn={record.fullyQualifiedName ?? ''}
            entityType={EntityType.METRIC}
            handleTagSelection={noopWithPromise}
            hasTagEditAccess={false}
            index={index}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
      },
      ...ownerTableObject<Metric>(),
    ],
    []
  );

  useEffect(() => {
    init();
  }, [pageSize]);

  if (loading) {
    return <Loader />;
  }

  if (error && !loading) {
    return (
      <ErrorPlaceHolder>
        <Typography.Paragraph className="text-center m-auto">
          {error}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageLayoutV1 pageTitle={t('label.metric-plural')}>
      <Row className="p-b-md" gutter={[0, 16]}>
        <Col span={24}>
          <div className="d-flex justify-between">
            <PageHeader
              data={{
                header: t('label.metric-plural'),
                subHeader: t('message.metric-description'),
              }}
            />
            {permission.Create && (
              <LimitWrapper resource="metric">
                <Button
                  data-testid="create-metric"
                  type="primary"
                  onClick={() => navigate(ROUTES.ADD_METRIC)}>
                  {t('label.add-entity', { entity: t('label.metric') })}
                </Button>
              </LimitWrapper>
            )}
          </div>
        </Col>
        <Col span={24}>
          <Table
            columns={columns}
            customPaginationProps={{
              showPagination,
              currentPage,
              isLoading: loadingMore,
              pageSize,
              paging,
              pagingHandler: onPageChange,
              onShowSizeChange: handlePageSizeChange,
            }}
            dataSource={metrics}
            loading={loadingMore}
            locale={{
              emptyText: (
                <ErrorPlaceHolder
                  className="p-y-md border-none"
                  heading={t('label.metric')}
                  permission={permission.Create}
                  permissionValue={t('label.create-entity', {
                    entity: t('label.metric'),
                  })}
                  type={ERROR_PLACEHOLDER_TYPE.CREATE}
                  onClick={() => navigate(ROUTES.ADD_METRIC)}
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default MetricListPage;
