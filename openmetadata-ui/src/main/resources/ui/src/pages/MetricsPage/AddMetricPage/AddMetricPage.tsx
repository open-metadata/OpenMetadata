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
import {
  FocusEvent,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import CustomUnitSelect from '../../../components/common/CustomUnitSelect/CustomUnitSelect';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { OnboardingCreationChecklist } from '../../../components/governance/onboarding/OnboardingCreationChecklist';
import {
  OnboardingSupplementalFields,
  OnboardingSupplementalHandle,
} from '../../../components/governance/onboarding/OnboardingSupplementalFields';
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
import { CustomProperty } from '../../../generated/entity/type';
import {
  IntakeForm,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import { createMetric } from '../../../rest/metricsAPI';
import { generateFormFields } from '../../../utils/formUtils';
import { getCreationIntakeFields } from '../../../utils/governance/onboarding/Onboarding.utils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../components/Database/SchemaEditor/SchemaEditor'))
);

const AddMetricPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [activeField, setActiveField] = useState<string>('');
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [properties, setProperties] = useState<CustomProperty[]>([]);
  const supplementalRef = useRef<OnboardingSupplementalHandle>(null);
  const onboardingValues = Form.useWatch([], form);
  const [supplementalValues, setSupplementalValues] = useState<
    Record<string, unknown>
  >({});
  const draftValues = {
    ...onboardingValues,
    ...supplementalValues,
    metricExpression: { code: onboardingValues?.code },
  };
  const intakeFields = getCreationIntakeFields(intakeForm, draftValues);
  useEffect(() => {
    let active = true;
    Promise.all([
      getIntakeFormByEntityType(TargetEntityType.Metric),
      getCustomPropertiesByEntityType(TargetEntityType.Metric),
    ])
      .then(([config, custom]) => {
        if (active) {
          setIntakeForm(config);
          setProperties(custom ?? []);
        }
      })
      .catch((error) => showErrorToast(error as AxiosError));

    return () => {
      active = false;
    };
  }, []);

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

  const handleUnitOfMeasurementChange = (
    unitOfMeasurement: string,
    customUnitOfMeasurement?: string
  ) => {
    form.setFieldsValue({
      unitOfMeasurement,
      customUnitOfMeasurement,
    });
  };

  const handleSubmit = async (
    values: Exclude<CreateMetric, 'metricExpression'> & {
      code?: string;
      language?: Language;
      customUnitOfMeasurement?: string;
    }
  ) => {
    if (!(await (supplementalRef.current?.validate() ?? true))) {
      return;
    }
    setIsCreating(true);
    try {
      const createMetricPayload: CreateMetric = {
        ...omit(values, ['code', 'language']),
        ...supplementalRef.current?.getValues(),
        metricExpression: {
          code: values.code,
          language: values.language,
        },
      };

      if (
        values.unitOfMeasurement === UnitOfMeasurement.Other &&
        values.customUnitOfMeasurement
      ) {
        createMetricPayload.customUnitOfMeasurement =
          values.customUnitOfMeasurement;
      }

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
                <OnboardingCreationChecklist
                  form={intakeForm}
                  values={draftValues}
                />
                <OnboardingSupplementalFields
                  fields={intakeFields.filter(
                    (field) =>
                      ![
                        'name',
                        'displayName',
                        'description',
                        'granularity',
                        'metricType',
                        'metricExpression.code',
                        'unitOfMeasurement',
                        'language',
                      ].includes(field.fieldPath)
                  )}
                  properties={properties}
                  ref={supplementalRef}
                  onValuesChange={setSupplementalValues}
                />
              </Col>
              <Col span={24}>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  onFocus={handleFieldFocus}>
                  {generateFormFields(
                    formFields.map((field) => {
                      const intake = intakeFields.find(
                        (item) => item.fieldPath === field.name
                      );

                      return intake?.required
                        ? {
                            ...field,
                            required: true,
                            rules: [
                              ...(field.rules ?? []),
                              {
                                required: true,
                                message:
                                  intake.errorMessage ??
                                  t('label.field-required', {
                                    field: intake.fieldLabel,
                                  }),
                              },
                            ],
                          }
                        : field;
                    })
                  )}
                  <Form.Item
                    label={t('label.unit-of-measurement')}
                    name="unitOfMeasurement"
                    rules={
                      intakeFields.some(
                        (field) =>
                          field.fieldPath === 'unitOfMeasurement' &&
                          field.required
                      )
                        ? [
                            {
                              required: true,
                              message: t('label.field-required', {
                                field: t('label.unit-of-measurement'),
                              }),
                            },
                          ]
                        : []
                    }>
                    <CustomUnitSelect
                      customValue={form.getFieldValue(
                        'customUnitOfMeasurement'
                      )}
                      dataTestId="unitOfMeasurement"
                      placeholder={t('label.select-field', {
                        field: t('label.unit-of-measurement'),
                      })}
                      onChange={handleUnitOfMeasurementChange}
                    />
                  </Form.Item>
                  <Form.Item hidden name="customUnitOfMeasurement">
                    <input type="hidden" />
                  </Form.Item>
                  <Form.Item
                    data-testid="expression-code-container"
                    label={t('label.code')}
                    name="code"
                    rules={
                      intakeFields.some(
                        (field) =>
                          field.fieldPath === 'metricExpression.code' &&
                          field.required
                      )
                        ? [
                            {
                              required: true,
                              message: t('label.field-required', {
                                field: t('label.code'),
                              }),
                            },
                          ]
                        : []
                    }
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
