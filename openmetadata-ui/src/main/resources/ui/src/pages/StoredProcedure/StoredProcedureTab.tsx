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
import { Col, Row, Switch, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../../components/Loader/Loader';
import { PAGE_SIZE } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { ServicePageData } from '../../pages/ServiceDetailsPage/ServiceDetailsPage';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityLink } from '../../utils/TableUtils';
import { StoredProcedureTabProps } from './storedProcedure.interface';

const StoredProcedureTab = ({
  storedProcedure,
  pagingHandler,
  fetchStoredProcedure,
  onShowDeletedStoreProcedureChange,
}: StoredProcedureTabProps) => {
  const { t } = useTranslation();
  const { data, isLoading, deleted, paging, currentPage } = storedProcedure;

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 350,
        render: (_, record) => (
          <Link
            to={getEntityLink(
              EntityType.STORED_PROCEDURE,
              record.fullyQualifiedName ?? ''
            )}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          isEmpty(text) ? (
            <Typography.Text className="text-grey-muted">
              {t('label.no-description')}
            </Typography.Text>
          ) : (
            <RichTextEditorPreviewer markdown={text} />
          ),
      },
    ],
    []
  );

  useEffect(() => {
    fetchStoredProcedure();
  }, [deleted]);

  return (
    <Row className="p-lg" data-testid="stored-procedure-table" gutter={[0, 16]}>
      <Col className="d-flex justify-end" span={24}>
        <Switch
          checked={deleted}
          data-testid="show-deleted-stored-procedure"
          onClick={onShowDeletedStoreProcedureChange}
        />
        <Typography.Text className="m-l-xs">
          {t('label.deleted')}
        </Typography.Text>{' '}
      </Col>
      <Col span={24}>
        <Table
          bordered
          columns={tableColumn}
          dataSource={data}
          loading={{
            spinning: isLoading,
            indicator: <Loader size="small" />,
          }}
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
          }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Col>

      <Col span={24}>
        {paging && paging.total > PAGE_SIZE && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            paging={paging}
            pagingHandler={pagingHandler}
          />
        )}
      </Col>
    </Row>
  );
};

export default StoredProcedureTab;
