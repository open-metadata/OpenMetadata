/*
 *  Copyright 2024 Collate.
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
import { Button, Col, Form, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { omit, startCase } from 'lodash';
import { FocusEvent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import SchemaEditor from '../../../components/Database/SchemaEditor/SchemaEditor';
import { ROUTES } from '../../../constants/constants';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { OPEN_METADATA } from '../../../constants/service-guide.constant';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  CreateMetric,
  Language,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/api/data/createMetric';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { createMetric } from '../../../rest/metricsAPI';
import { generateFormFields } from '../../../utils/formUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const AddMetricPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [activeField, setActiveField] = useState<string>('');

  const { breadcrumb, title } = useMemo(() => {
    const title = t('label.add-new-entity', {
      entity: t('label.metric'),
    });

    return {
      breadcrumb: [
        {
          name: t('label.metric-plural'),
          url: ROUTES.METRICS,
        },
        {
          name: title,
          url: '',
        },
      ],
      title,
    };
  }, []);

  const formFields: FieldProp[] = useMemo(() => {
    return [
      {
        name: 'name',
        id: 'root/name',
        label: t('label.name'),
        required: true,
        placeholder: t('label.name'),
        type: FieldTypes.TEXT,
        props: {
          'data-testid': 'name',
        },
        rules: NAME_FIELD_RULES,
      },
      {
        name: 'displayName',
        id: 'root/displayName',
        label: t('label.display-name'),
        required: false,
        placeholder: t('label.display-name'),
        type: FieldTypes.TEXT,
        props: {
          'data-testid': 'display-name',
        },
      },
      {
        name: 'description',
        required: false,
        label: t('label.description'),
        id: 'root/description',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'description',
          initialValue: '',
          height: '200px',
        },
        rules: [
          {
            whitespace: true,
            message: t('label.field-required', {
              field: t('label.description'),
            }),
          },
        ],
      },
      {
        name: 'granularity',
        required: false,
        label: t('label.granularity'),
        id: 'root/granularity',
        type: FieldTypes.SELECT,
        props: {
          'data-testid': 'granularity',
          options: Object.values(MetricGranularity).map((granularity) => ({
            key: granularity,
            label: startCase(granularity.toLowerCase()),
            value: granularity,
          })),
          placeholder: `${t('label.select-field', {
            field: t('label.granularity'),
          })}`,
          showSearch: true,
          filterOption: (input: string, option: { label: string }) => {
            return (option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase());
          },
        },
      },
      {
        name: 'metricType',
        required: false,
        label: t('label.metric-type'),
        id: 'root/metricType',
        type: FieldTypes.SELECT,
        props: {
          'data-testid': 'metricType',
          options: Object.values(MetricType).map((metricType) => ({
            key: metricType,
            label: startCase(metricType.toLowerCase()),
            value: metricType,
          })),
          placeholder: `${t('label.select-field', {
            field: t('label.metric-type'),
          })}`,
          showSearch: true,
          filterOption: (input: string, option: { label: string }) => {
            return (option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase());
          },
        },
      },
      {
        name: 'unitOfMeasurement',
        required: false,
        label: t('label.unit-of-measurement'),
        id: 'root/unitOfMeasurement',
        type: FieldTypes.SELECT,
        props: {
          'data-testid': 'unitOfMeasurement',
          options: Object.values(UnitOfMeasurement).map(
            (unitOfMeasurement) => ({
              key: unitOfMeasurement,
              label: startCase(unitOfMeasurement.toLowerCase()),
              value: unitOfMeasurement,
            })
          ),
          placeholder: `${t('label.select-field', {
            field: t('label.unit-of-measurement'),
          })}`,
          showSearch: true,
          filterOption: (input: string, option: { label: string }) => {
            return (option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase());
          },
        },
      },
      {
        name: 'language',
        required: false,
        label: t('label.language'),
        id: 'root/language',
        type: FieldTypes.SELECT,
        props: {
          'data-testid': 'language',
          options: Object.values(Language).map((language) => ({
            key: language,
            label: language,
            value: language,
          })),
          placeholder: `${t('label.select-field', {
            field: t('label.language'),
          })}`,
          showSearch: true,
          filterOption: (input: string, option: { label: string }) => {
            return (option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase());
          },
        },
      },
    ];
  }, []);

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLFormElement>) => {
    let activeField = '';
    const isDescription = event.target.classList.contains('ProseMirror');
    const isMetricExpression =
      event.target.classList.contains('CodeMirror') ||
      event.target.id === 'root/language';

    if (isDescription) {
      activeField = 'root/description';
    } else if (isMetricExpression) {
      activeField = 'root/metricExpression';
    } else {
      activeField = event.target.id;
    }

    setActiveField(activeField);
  }, []);

  const handleSubmit = async (
    values: Exclude<CreateMetric, 'metricExpression'> & {
      code?: string;
      language?: Language;
    }
  ) => {
    setIsCreating(true);
    try {
      const createMetricPayload: CreateMetric = {
        ...omit(values, ['code', 'language']),
        metricExpression: {
          code: values.code,
          language: values.language,
        },
      };

      const response = await createMetric(createMetricPayload);
      navigate(
        getEntityDetailsPath(
          EntityType.METRIC,
          response.fullyQualifiedName ?? ''
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="add-metric-container">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <TitleBreadcrumb titleLinks={breadcrumb} />
              </Col>

              <Col span={24}>
                <Typography.Title
                  className="m-b-0"
                  data-testid="heading"
                  level={5}>
                  {title}
                </Typography.Title>
              </Col>
              <Col span={24}>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  onFocus={handleFieldFocus}>
                  {generateFormFields(formFields)}
                  <Form.Item
                    data-testid="expression-code-container"
                    label={t('label.code')}
                    name="code"
                    trigger="onChange">
                    <SchemaEditor
                      className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                      mode={{ name: CSMode.SQL }}
                      showCopyButton={false}
                    />
                  </Form.Item>
                  <Row justify="end">
                    <Col>
                      <Button
                        data-testid="back-button"
                        type="link"
                        onClick={() => navigate(ROUTES.METRICS)}>
                        {t('label.back')}
                      </Button>
                    </Col>
                    <Col>
                      <Button
                        data-testid="create-button"
                        htmlType="submit"
                        loading={isCreating}
                        type="primary">
                        {t('label.create')}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Col>
            </Row>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={title}
      secondPanel={{
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
        children: (
          <ServiceDocPanel
            activeField={activeField}
            serviceName="MetricEntity"
            serviceType={OPEN_METADATA}
          />
        ),
      }}
    />
  );
};

export default withPageLayout(AddMetricPage);
