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
import { ReactComponent as FailBadgeIcon } from 'assets/svg/fail-badge.svg';
import { ReactComponent as SuccessBadgeIcon } from 'assets/svg/success-badge.svg';
import { CSVImportResult, Status } from 'generated/type/csvImportResult';
import { isEmpty } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';
import { parseCSV } from 'utils/GlossaryUtils';
import { GlossaryCSVRecord } from '../ImportGlossary/ImportGlossary.interface';

interface Props {
  csvImportResult: CSVImportResult;
}

const ImportResult: FC<Props> = ({ csvImportResult }) => {
  const { readString } = usePapaParse();
  const { t } = useTranslation();
  const [parsedRecords, setParsedRecords] = useState<GlossaryCSVRecord[]>([]);

  const columns: ColumnsType<GlossaryCSVRecord> = useMemo(
    () => [
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        fixed: true,
        render: (
          status: GlossaryCSVRecord['status'],
          record: GlossaryCSVRecord
        ) => {
          return (
            <Space align="start" data-testid="status-container">
              {status === Status.Success && (
                <SuccessBadgeIcon
                  className="m-t-xss"
                  data-testid="success-badge"
                  height={16}
                  width={16}
                />
              )}
              {status === Status.Failure && (
                <>
                  <FailBadgeIcon
                    className="m-t-xss"
                    data-testid="failure-badge"
                    height={16}
                    width={16}
                  />
                  {record.details}
                </>
              )}
            </Space>
          );
        },
      },
      {
        title: t('label.parent'),
        dataIndex: 'parent',
        key: 'parent',
        fixed: true,
        render: (parent: GlossaryCSVRecord['parent']) => {
          return (
            <Typography.Paragraph style={{ minWidth: 150 }}>
              {isEmpty(parent) ? '--' : parent}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.name'),
        dataIndex: 'name*',
        key: 'name',
        fixed: true,
        render: (name: GlossaryCSVRecord['name*']) => {
          return (
            <Typography.Paragraph style={{ minWidth: 150 }}>
              {name}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.display-name'),
        dataIndex: 'displayName',
        key: 'displayName',
        render: (displayName: GlossaryCSVRecord['displayName']) => {
          return (
            <Typography.Paragraph style={{ minWidth: 150 }}>
              {isEmpty(displayName) ? '--' : displayName}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (description: GlossaryCSVRecord['description']) => {
          return (
            <Typography.Paragraph
              ellipsis={{
                rows: 2,
              }}
              style={{ width: 300 }}
              title={description}>
              {isEmpty(description) ? '--' : description}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.synonym-plural'),
        dataIndex: 'synonyms',
        key: 'synonyms',
        render: (synonyms: GlossaryCSVRecord['synonyms']) => {
          const value = synonyms?.split(';').join(', ');

          return (
            <Typography.Paragraph style={{ minWidth: 150 }}>
              {isEmpty(synonyms) ? '--' : value}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.related-term-plural'),
        dataIndex: 'relatedTerms',
        key: 'relatedTerms',
        render: (relatedTerms: GlossaryCSVRecord['relatedTerms']) => {
          const value = relatedTerms?.split(';').join(', ');

          return (
            <Typography.Paragraph style={{ minWidth: 150 }}>
              {isEmpty(relatedTerms) ? '--' : value}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.reference-plural'),
        dataIndex: 'references',
        key: 'relatedTerms',
        render: (references: GlossaryCSVRecord['references']) => {
          return (
            <Typography.Paragraph style={{ minWidth: 150, maxWidth: 300 }}>
              {isEmpty(references) ? '--' : references}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        render: (tags: GlossaryCSVRecord['tags']) => {
          const value = tags?.split(';').join(', ');

          return (
            <Typography.Paragraph style={{ minWidth: 150 }}>
              {isEmpty(tags) ? '--' : value}
            </Typography.Paragraph>
          );
        },
      },
    ],
    []
  );

  const parseCsvFile = () => {
    if (csvImportResult.importResultsCsv) {
      readString(csvImportResult.importResultsCsv, {
        worker: true,
        complete: (results) => {
          // results.data is returning data with unknown type
          setParsedRecords(
            parseCSV(results.data as string[][]).map((value) => ({
              ...value,
              key: value['name*'],
            }))
          );
        },
      });
    }
  };

  useEffect(() => {
    parseCsvFile();
  }, [csvImportResult.importResultsCsv]);

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
          className="vertical-top-align-td"
          columns={columns}
          data-testid="import-result-table"
          dataSource={parsedRecords}
          pagination={false}
          rowKey="name"
          scroll={{ x: true }}
          size="small"
        />
      </Col>
    </Row>
  );
};

export default ImportResult;
