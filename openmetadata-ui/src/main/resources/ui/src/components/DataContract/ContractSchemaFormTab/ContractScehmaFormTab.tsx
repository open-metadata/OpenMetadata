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
import { Button, Col, Row } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Column } from '../../../generated/entity/data/table';
import { useFqn } from '../../../hooks/useFqn';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import Table from '../../common/Table/Table';

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
    setSchema(response.data);
  }, [fqn]);

  useEffect(() => {
    setSelectedKeys(selectedSchema);
  }, [selectedSchema]);

  useEffect(() => {
    fetchTableColumns();
  }, [fqn]);

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.type'),
        dataIndex: 'type',
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'glossaryTerms',
      },
      {
        title: t('label.constraint-plural'),
        dataIndex: 'contraints',
      },
    ],
    [t]
  );

  return (
    <Row className="h-full">
      <Col span={24}>
        <Table
          columns={columns}
          dataSource={schema}
          rowKey="name"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (selectedRowKeys) => {
              setSelectedKeys(selectedRowKeys as string[]);
            },
          }}
        />
      </Col>
      <Col className="d-flex justify-end">
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
        </Button>
        <Button type="default" onClick={onPrev}>
          {t('label.prev')}
        </Button>
      </Col>
    </Row>
  );
};
