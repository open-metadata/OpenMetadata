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
import { Col, Row, Space, Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';

import { CSVImportResult, Status } from 'generated/type/csvImportResult';
import React, { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { parseCSV } from 'utils/GlossaryUtils';
import { GlossaryCSVRecord } from '../ImportGlossary/ImportGlossary.interface';

interface Props {
  csvImportResult: CSVImportResult;
}

const ImportResult: FC<Props> = ({ csvImportResult }) => {
  const { t } = useTranslation();

  const parsedRecords: GlossaryCSVRecord[] = useMemo(() => {
    const importResult = csvImportResult?.importResultsCsv;

    if (importResult) {
      return parseCSV(importResult);
    } else {
      return [];
    }
  }, [csvImportResult]);

  const columns: ColumnsType<GlossaryCSVRecord> = useMemo(
    () => [
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        render: (status: GlossaryCSVRecord['status']) => {
          return (
            <Typography.Text
              className={classNames(
                {
                  'text-success': status === Status.Success,
                },
                { 'text-failure': status === Status.Failure }
              )}>
              {status}
            </Typography.Text>
          );
        },
      },
      {
        title: t('label.detail-plural'),
        dataIndex: 'details',
        key: 'details',
        render: (details: GlossaryCSVRecord['details']) => {
          return <Typography.Text>{details ?? '--'}</Typography.Text>;
        },
      },
      {
        title: t('label.parent'),
        dataIndex: 'parent',
        key: 'parent',
        render: (parent: GlossaryCSVRecord['parent']) => {
          return <Typography.Text>{parent ?? '--'}</Typography.Text>;
        },
      },
      {
        title: t('label.name'),
        dataIndex: 'name*',
        key: 'name',
        render: (name: GlossaryCSVRecord['name*']) => {
          return <Typography.Text>{name}</Typography.Text>;
        },
      },
      {
        title: t('label.display-name'),
        dataIndex: 'displayName',
        key: 'displayName',
        render: (displayName: GlossaryCSVRecord['displayName']) => {
          return <Typography.Text>{displayName ?? '--'}</Typography.Text>;
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description*',
        key: 'description',
        render: (description: GlossaryCSVRecord['description*']) => {
          return <RichTextEditorPreviewer markdown={description ?? '--'} />;
        },
      },
      {
        title: t('label.synonym-plural'),
        dataIndex: 'synonyms',
        key: 'synonyms',
        render: (synonyms: GlossaryCSVRecord['synonyms']) => {
          return <Typography.Text>{synonyms ?? '--'}</Typography.Text>;
        },
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        render: (tags: GlossaryCSVRecord['tags']) => {
          return <Typography.Text>{tags ?? '--'}</Typography.Text>;
        },
      },
    ],
    []
  );

  return (
    <Row data-testid="import-results" gutter={[16, 16]}>
      <Col span={24}>
        <Space>
          <div>
            <Typography.Text type="secondary">{`${t(
              'label.number-of-rows'
            )}: `}</Typography.Text>
            <span className="text-600" data-testid="processed-row">
              {csvImportResult.numberOfRowsProcessed}
            </span>
          </div>
          {' | '}
          <div>
            <Typography.Text type="secondary">{`${t(
              'label.passed'
            )}: `}</Typography.Text>
            <span className="text-600" data-testid="passed-row">
              {csvImportResult.numberOfRowsPassed}
            </span>
          </div>
          {' | '}
          <div>
            <Typography.Text type="secondary">{`${t(
              'label.failed'
            )}: `}</Typography.Text>
            <span className="text-600" data-testid="failed-row">
              {csvImportResult.numberOfRowsFailed}
            </span>
          </div>
        </Space>
      </Col>
      <Col span={24}>
        <Table
          bordered
          columns={columns}
          data-testid="import-result-table"
          dataSource={parsedRecords}
          pagination={false}
          rowKey="name"
          size="small"
        />
      </Col>
    </Row>
  );
};

export default ImportResult;
