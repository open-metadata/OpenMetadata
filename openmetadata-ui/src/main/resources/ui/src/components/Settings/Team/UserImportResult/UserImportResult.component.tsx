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
import { Space, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';
import FailBadgeIcon from '../../../../assets/svg/fail-badge.svg?react';
import SuccessBadgeIcon from '../../../../assets/svg/success-badge.svg?react';
import { Status } from '../../../../generated/type/csvImportResult';
import { parseCSV } from '../../../../utils/EntityImport/EntityImportUtils';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../../common/Table/Table';
import {
  UserCSVRecord,
  UserImportResultProps,
} from './UserImportResult.interface';

export const UserImportResult = ({
  csvImportResult,
}: UserImportResultProps) => {
  const { readString } = usePapaParse();
  const { t } = useTranslation();
  const [parsedRecords, setParsedRecords] = useState<UserCSVRecord[]>([]);
  const [loading, setIsLoading] = useState(true);

  const columns = useMemo(() => {
    const data: ColumnsType<UserCSVRecord> = [
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        fixed: true,
        render: (status: string, record) => {
          return (
            <Space
              align="start"
              data-testid="status-container"
              // Added max width because in case of full success we don't want to occupied full width
              style={{ maxWidth: 200 }}>
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
        title: t('label.name'),
        dataIndex: 'name*',
        key: 'name',
        fixed: true,
        render: (name: string) => {
          return (
            <Typography.Paragraph style={{ width: 200 }}>
              {name}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.display-name'),
        dataIndex: 'displayName',
        key: 'displayName',
        render: (displayName: string) => {
          return (
            <Typography.Paragraph style={{ width: 200 }}>
              {displayName || '--'}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (description: string) => {
          return (
            <RichTextEditorPreviewerNew
              className="w-80"
              enableSeeMoreVariant={false}
              markdown={description}
              reducePreviewLineClass="max-one-line"
            />
          );
        },
      },
      {
        title: t('label.email'),
        dataIndex: 'email*',
        key: 'email',
        render: (value: string) => {
          return (
            <Typography.Paragraph style={{ width: 200 }}>
              {value || '--'}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.timezone'),
        dataIndex: 'timezone',
        key: 'timezone',
        render: (value: string) => {
          return (
            <Typography.Paragraph style={{ width: 200 }}>
              {value || '--'}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.admin'),
        dataIndex: 'isAdmin',
        key: 'isAdmin',
        render: (value: string) => {
          return (
            <Typography.Paragraph style={{ width: 200 }}>
              {value || '--'}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.team-plural'),
        dataIndex: 'teams*',
        key: 'teams*',
        render: (value: string) => {
          return (
            <Typography.Paragraph style={{ width: 200 }}>
              {value || '--'}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.role-plural'),
        dataIndex: 'Roles',
        key: 'Roles',
        render: (value: string) => {
          return <Typography.Paragraph>{value || '--'}</Typography.Paragraph>;
        },
      },
    ];

    return data;
  }, [parsedRecords]);

  const parseCsvFile = () => {
    if (csvImportResult.importResultsCsv) {
      readString(csvImportResult.importResultsCsv, {
        worker: true,
        complete: (results) => {
          // results.data is returning data with unknown type
          setParsedRecords(
            parseCSV<UserCSVRecord>(results.data as string[][]).map(
              (value) => ({
                ...value,
                key: value['name*'],
              })
            )
          );
          setIsLoading(false);
        },
      });
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    parseCsvFile();
  }, [csvImportResult.importResultsCsv]);

  return (
    <Table
      className="vertical-top-align-td"
      columns={columns}
      data-testid="import-result-table"
      dataSource={parsedRecords}
      loading={loading}
      pagination={false}
      rowKey="name*"
      scroll={{ x: true }}
      size="small"
    />
  );
};
