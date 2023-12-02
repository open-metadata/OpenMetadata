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
import { Form, Input, Select } from 'antd';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ENTITY_NAME_REGEX } from '../../constants/regex.constants';
import { CSMode } from '../../enums/codemirror.enum';
import { CustomMetric } from '../../generated/entity/data/table';
import { getEntityName } from '../../utils/EntityUtils';
import Loader from '../Loader/Loader';
import SchemaEditor from '../SchemaEditor/SchemaEditor';
import { CustomMetricFormProps } from './CustomMetricForm.interface';

const CustomMetricForm = ({
  isColumnMetric,
  initialValues,
  onFinish,
  form,
  table,
  isEditMode = false,
}: CustomMetricFormProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  const { activeColumnFqn } = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeColumnFqn: string };
  }, [location.search]);

  const { metricNames, columnOptions } = useMemo(() => {
    let customMetrics = table?.customMetrics ?? [];

    if (isColumnMetric) {
      customMetrics =
        table?.columns?.find(
          (column) => column.fullyQualifiedName === activeColumnFqn
        )?.customMetrics ?? [];
    }

    return {
      metricNames: customMetrics.map((metric) => metric.name),
      columnOptions: table ? table.columns : [],
    };
  }, [activeColumnFqn, isColumnMetric, table]);

  useEffect(() => {
    if (form && initialValues) {
      form.setFieldsValue(initialValues);
    }
    setIsLoading(false);
  }, [initialValues]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Form<CustomMetric> form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label={t('label.name')}
        name="name"
        rules={[
          {
            required: true,
            message: t('label.field-required', {
              field: t('label.name'),
            }),
          },
          {
            pattern: ENTITY_NAME_REGEX,
            message: t('message.entity-name-validation'),
          },
          {
            min: 1,
            max: 128,
            message: `${t('message.entity-maximum-size', {
              entity: `${t('label.name')}`,
              max: '128',
            })}`,
          },
          {
            validator: (_, value) => {
              if (metricNames.includes(value) && !isEditMode) {
                return Promise.reject(
                  t('message.entity-already-exists', {
                    entity: t('label.custom-metric'),
                  })
                );
              }

              return Promise.resolve();
            },
          },
        ]}>
        <Input
          disabled={isEditMode}
          placeholder={t('label.enter-entity', { entity: t('label.name') })}
        />
      </Form.Item>
      {isColumnMetric && (
        <Form.Item
          label={t('label.column')}
          name="columnName"
          rules={[
            {
              required: true,
              message: t('label.field-required', {
                field: t('label.column'),
              }),
            },
          ]}>
          <Select
            disabled={isEditMode}
            placeholder={t('label.please-select-entity', {
              entity: t('label.column'),
            })}>
            {columnOptions?.map((column) => (
              <Select.Option key={column.name} value={column.name}>
                {getEntityName(column)}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}
      <Form.Item
        data-testid="sql-editor-container"
        label={t('label.sql-uppercase-query')}
        name="expression"
        rules={[
          {
            required: true,
            message: t('label.field-required', {
              field: t('label.sql-uppercase-query'),
            }),
          },
        ]}
        trigger="onChange">
        <SchemaEditor
          className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
          mode={{ name: CSMode.SQL }}
          options={{
            readOnly: false,
          }}
        />
      </Form.Item>
    </Form>
  );
};

export default CustomMetricForm;
