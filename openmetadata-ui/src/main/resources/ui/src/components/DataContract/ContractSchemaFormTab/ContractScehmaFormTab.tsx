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
import { Button, Card, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Column } from '../../../generated/entity/data/table';
import { TagSource } from '../../../generated/tests/testCase';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import { highlightSearchArrayElement } from '../../../utils/EntityUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import Table from '../../common/Table/Table';
import { TableCellRendered } from '../../Database/SchemaTable/SchemaTable.interface';
import TableTags from '../../Database/TableTags/TableTags.component';

export const ContractSchemaFormTab: React.FC<{
  selectedSchema: string[];
  onNext: (data: Partial<DataContract>) => void;
  onPrev: () => void;
}> = ({ selectedSchema, onNext, onPrev }) => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const [schema, setSchema] = useState<Column[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const fetchTableColumns = useCallback(async () => {
    const response = await getTableColumnsByFQN(fqn);
    setSchema(pruneEmptyChildren(response.data));
  }, [fqn]);

  useEffect(() => {
    setSelectedKeys(selectedSchema);
  }, [selectedSchema]);

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
      <Typography.Paragraph
        className="cursor-pointer"
        ellipsis={{ tooltip: displayValue, rows: 3 }}>
        {highlightSearchArrayElement(dataTypeDisplay, '')}
      </Typography.Paragraph>
    );
  };

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.type'),
        dataIndex: 'type',
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
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
        dataIndex: 'glossaryTerms',
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
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
        dataIndex: 'contraints',
      },
    ],
    [t]
  );

  return (
    <>
      <Card className="container bg-grey p-box">
        <div className="m-b-sm">
          <Typography.Title className="m-0" level={5}>
            {t('label.schema')}
          </Typography.Title>
          <Typography.Paragraph className="m-0 text-sm" type="secondary">
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
            onChange: (selectedRowKeys) => {
              setSelectedKeys(selectedRowKeys as string[]);
            },
          }}
        />
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button icon={<ArrowLeftOutlined />} type="default" onClick={onPrev}>
          {t('label.previous')}
        </Button>
        <Button
          type="primary"
          onClick={() =>
            onNext({
              schema: schema.filter((column) =>
                selectedKeys.includes(column.name)
              ),
            })
          }>
          {t('label.next')}
          <ArrowRightOutlined />
        </Button>
      </div>
    </>
  );
};
