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
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, Tag, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TABLE_COLUMNS_KEYS } from '../../../constants/TableKeys.constants';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Column } from '../../../generated/entity/data/table';
import { TagSource } from '../../../generated/tests/testCase';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import {
  getEntityName,
  highlightSearchArrayElement,
} from '../../../utils/EntityUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import Table from '../../common/Table/Table';
import { TableCellRendered } from '../../Database/SchemaTable/SchemaTable.interface';
import TableTags from '../../Database/TableTags/TableTags.component';

export const ContractSchemaFormTab: React.FC<{
  selectedSchema: string[];
  onNext: () => void;
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  nextLabel?: string;
  prevLabel?: string;
}> = ({ selectedSchema, onNext, onChange, onPrev, nextLabel, prevLabel }) => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const [schema, setSchema] = useState<Column[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(selectedSchema);

  const handleChangeTable = useCallback(
    (selectedRowKeys: Key[]) => {
      setSelectedKeys(selectedRowKeys as string[]);
      onChange({
        schema: schema.filter((column) =>
          selectedRowKeys.includes(column.name)
        ),
      });
    },
    [schema, onChange]
  );

  const fetchTableColumns = useCallback(async () => {
    const response = await getTableColumnsByFQN(fqn);
    setSchema(pruneEmptyChildren(response.data));
  }, [fqn]);

  useEffect(() => {
    fetchTableColumns();
  }, [fqn]);

  const renderDataTypeDisplay: TableCellRendered<Column, 'dataTypeDisplay'> = (
    dataTypeDisplay,
    record
  ) => {
    const displayValue = isEmpty(dataTypeDisplay)
      ? record.dataType
      : dataTypeDisplay;

    if (isEmpty(displayValue)) {
      return NO_DATA_PLACEHOLDER;
    }

    return (
      <Tag
        className="cursor-pointer custom-tag"
        color="purple"
        title={displayValue}>
        {highlightSearchArrayElement(dataTypeDisplay, '')}
      </Tag>
    );
  };

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        render: (_, record: Column) => (
          <Typography.Text className="schema-table-name">
            {getEntityName(record)}
          </Typography.Text>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            isReadOnly
            entityFqn={fqn}
            entityType={EntityType.TABLE}
            handleTagSelection={() => Promise.resolve()}
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
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.GLOSSARY,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            isReadOnly
            entityFqn={fqn}
            entityType={EntityType.TABLE}
            handleTagSelection={() => Promise.resolve()}
            hasTagEditAccess={false}
            index={index}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
      },
      {
        title: t('label.constraint-plural'),
        dataIndex: 'constraint',
      },
    ],
    [t]
  );

  return (
    <>
      <Card className="container bg-grey p-box">
        <div className="m-b-sm">
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.schema')}
          </Typography.Text>
          <Typography.Paragraph className="contract-detail-form-tab-description">
            {t('message.data-contract-schema-description')}
          </Typography.Paragraph>
        </div>
        <Table
          columns={columns}
          dataSource={schema}
          pagination={false}
          rowKey="name"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: handleChangeTable,
          }}
        />
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button icon={<ArrowLeftOutlined />} type="default" onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
        <Button type="primary" onClick={onNext}>
          {nextLabel ?? t('label.next')}
          <ArrowRightOutlined />
        </Button>
      </div>
    </>
  );
};
