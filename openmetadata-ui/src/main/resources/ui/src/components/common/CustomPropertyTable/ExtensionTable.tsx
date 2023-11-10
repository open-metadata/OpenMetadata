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
import { Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isString, map } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import RichTextEditorPreviewer from '../RichTextEditor/RichTextEditorPreviewer';
import {
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from './CustomPropertyTable.interface';

interface ExtensionDataSource {
  name: string;
  value: string | number;
}

export const ExtensionTable = ({
  extension,
}: {
  extension: ExtentionEntities[ExtentionEntitiesKeys]['extension'];
}) => {
  const { t } = useTranslation();
  const dataSource: ExtensionDataSource[] = useMemo(() => {
    return map(extension, (value, key) => ({ name: key, value }));
  }, [extension]);

  const tableColumn: ColumnsType<ExtensionDataSource> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (name) => name,
      },
      {
        title: t('label.value'),
        dataIndex: 'value',
        key: 'value',
        render: (value) => {
          const isStringValue = isString(value);

          if (isStringValue) {
            return <RichTextEditorPreviewer markdown={value || ''} />;
          }

          return (
            <Typography.Text className="break-all" data-testid="value">
              {value}
            </Typography.Text>
          );
        },
      },
    ];
  }, []);

  return (
    <Table
      bordered
      className="m-md"
      columns={tableColumn}
      data-testid="custom-properties-table"
      dataSource={dataSource}
      pagination={false}
      rowKey="name"
      size="small"
    />
  );
};
