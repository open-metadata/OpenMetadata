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

import { Button, Card, Form, Input, Select, Space } from 'antd';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnGridFilters } from './ColumnGrid.interface';

interface ColumnGridFiltersProps {
  filters: ColumnGridFilters;
  onChange: (filters: ColumnGridFilters) => void;
}

const ColumnGridFiltersComponent: React.FC<ColumnGridFiltersProps> = ({
  filters,
  onChange,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const handleApplyFilters = useCallback(() => {
    const values = form.getFieldsValue();
    onChange(values);
  }, [form, onChange]);

  const handleResetFilters = useCallback(() => {
    form.resetFields();
    onChange({});
  }, [form, onChange]);

  return (
    <Card>
      <Form
        className="gap-3"
        form={form}
        initialValues={filters}
        layout="inline">
        <Form.Item
          label={t('label.column-name-pattern')}
          name="columnNamePattern"
          style={{ minWidth: '200px' }}>
          <Input
            allowClear
            placeholder={t('message.column-name-pattern-placeholder')}
          />
        </Form.Item>
        <Form.Item
          label={t('label.entity-type-plural')}
          name="entityTypes"
          style={{ minWidth: '200px' }}>
          <Select
            allowClear
            mode="multiple"
            placeholder={t('label.select-field', {
              field: t('label.entity-type-plural'),
            })}>
            <Select.Option value="table">{t('label.table')}</Select.Option>
            <Select.Option value="dashboard">
              {t('label.dashboard')}
            </Select.Option>
            <Select.Option value="topic">{t('label.topic')}</Select.Option>
            <Select.Option value="container">
              {t('label.container')}
            </Select.Option>
            <Select.Option value="search_index">
              {t('label.search-index')}
            </Select.Option>
          </Select>
        </Form.Item>
        <Form.Item
          label={t('label.service')}
          name="serviceName"
          style={{ minWidth: '180px' }}>
          <Input
            allowClear
            placeholder={t('label.select-field', {
              field: t('label.service'),
            })}
          />
        </Form.Item>
        <Form.Item
          label={t('label.database')}
          name="databaseName"
          style={{ minWidth: '180px' }}>
          <Input
            allowClear
            placeholder={t('label.select-field', {
              field: t('label.database'),
            })}
          />
        </Form.Item>
        <Form.Item
          label={t('label.schema')}
          name="schemaName"
          style={{ minWidth: '180px' }}>
          <Input
            allowClear
            placeholder={t('label.select-field', {
              field: t('label.schema'),
            })}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleApplyFilters}>
              {t('label.apply-filter-plural')}
            </Button>
            <Button onClick={handleResetFilters}>{t('label.reset')}</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ColumnGridFiltersComponent;
