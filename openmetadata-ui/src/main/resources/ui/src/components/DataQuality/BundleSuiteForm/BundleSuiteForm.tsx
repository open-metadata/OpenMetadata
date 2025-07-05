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

import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Row,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../constants/Schedular.constants';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { OwnerType } from '../../../enums/user.enum';
import {
  ConfigType,
  CreateIngestionPipeline,
  PipelineType,
} from '../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { CreateTestSuite } from '../../../generated/api/tests/createTestSuite';
import { LogLevels } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../../generated/tests/testCase';
import { TestSuite } from '../../../generated/tests/testSuite';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
} from '../../../rest/ingestionPipelineAPI';
import {
  addTestCaseToLogicalTestSuite,
  createTestSuites,
} from '../../../rest/testAPI';
import {
  getNameFromFQN,
  replaceAllSpacialCharWith_,
} from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { generateFormFields } from '../../../utils/formUtils';
import { getScheduleOptionsFromSchedules } from '../../../utils/SchedularUtils';
import { getIngestionName } from '../../../utils/ServiceUtils';
import { generateUUID } from '../../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ScheduleIntervalV1 from '../../Settings/Services/AddIngestion/Steps/ScheduleIntervalV1';
import { AddTestCaseList } from '../AddTestCaseList/AddTestCaseList.component';
import {
  BundleSuiteFormData,
  BundleSuiteFormProps,
} from './BundleSuiteForm.interface';
import './BundleSuiteForm.less';

// =============================================
// MAIN COMPONENT
// =============================================
const BundleSuiteForm: React.FC<BundleSuiteFormProps> = ({
  className,
  drawerProps,
  isDrawer = false,
  onCancel,
  onSuccess,
  initialValues,
}) => {
  // =============================================
  // HOOKS - External
  // =============================================
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = useForm<BundleSuiteFormData>();
  const { config } = useLimitStore();
  const { currentUser } = useApplicationStore();
  const { isAirflowAvailable } = useAirflowStatus();

  // =============================================
  // HOOKS - State
  // =============================================
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTestCases, setSelectedTestCases] = useState<TestCase[]>(
    initialValues?.testCases || []
  );

  // =============================================
  // HOOKS - Memoized Values
  // =============================================
  const pipelineSchedules = useMemo(() => {
    return config?.limits?.config.featureLimits.find(
      (feature) => feature.name === 'dataQuality'
    )?.pipelineSchedules;
  }, [config]);

  const schedulerOptions = useMemo(() => {
    if (isEmpty(pipelineSchedules) || !pipelineSchedules) {
      return undefined;
    }

    return getScheduleOptionsFromSchedules(pipelineSchedules);
  }, [pipelineSchedules]);

  // Form field definitions
  const basicInfoFormFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'name',
        label: t('label.name'),
        type: FieldTypes.TEXT,
        required: true,
        placeholder: t('label.enter-entity', { entity: t('label.name') }),
        props: { 'data-testid': 'test-suite-name' },
        id: 'root/name',
        rules: [
          {
            max: 256,
            message: t('message.entity-maximum-size', {
              entity: t('label.name'),
              max: 256,
            }),
          },
        ],
      },
      {
        name: 'description',
        label: t('label.description'),
        type: FieldTypes.DESCRIPTION,
        required: false,
        placeholder: t('label.enter-entity', {
          entity: t('label.description'),
        }),
        props: { 'data-testid': 'test-suite-description', rows: 3 },
        id: 'root/description',
      },
    ],
    [t]
  );

  const schedulerFormFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'pipelineName',
        label: t('label.name'),
        type: FieldTypes.TEXT,
        required: false,
        placeholder: t('label.enter-entity', { entity: t('label.name') }),
        props: { 'data-testid': 'pipeline-name' },
        id: 'root/pipelineName',
      },
    ],
    [t]
  );

  // =============================================
  // HOOKS - Effects
  // =============================================

  // Initialize form values
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        name: initialValues.name || '',
        description: initialValues.description || '',
        testCases: initialValues.testCases || [],
      });
    }
  }, [initialValues, form]);

  // =============================================
  // HOOKS - Callbacks
  // =============================================
  const handleTestCaseSelection = useCallback(
    (testCases: TestCase[]) => {
      setSelectedTestCases(testCases);
      form.setFieldValue('testCases', testCases);
    },
    [form]
  );

  const createAndDeployPipeline = async (
    testSuite: TestSuite,
    formData: BundleSuiteFormData
  ) => {
    try {
      const testSuiteName = replaceAllSpacialCharWith_(
        getNameFromFQN(testSuite.fullyQualifiedName ?? testSuite.name)
      );
      const pipelineName =
        formData.pipelineName ||
        getIngestionName(testSuiteName, PipelineType.TestSuite);

      const ingestionPayload: CreateIngestionPipeline = {
        airflowConfig: {
          scheduleInterval: formData.cron,
        },
        displayName: pipelineName,
        name: generateUUID(),
        loggerLevel: formData.enableDebugLog ? LogLevels.Debug : LogLevels.Info,
        pipelineType: PipelineType.TestSuite,
        raiseOnError: formData.raiseOnError ?? true,
        service: {
          id: testSuite.id ?? '',
          type: 'testSuite',
        },
        sourceConfig: {
          config: {
            type: ConfigType.TestSuite,
          },
        },
      };

      const pipeline = await addIngestionPipeline(ingestionPayload);

      if (isAirflowAvailable) {
        await deployIngestionPipelineById(pipeline.id ?? '');
      }

      showSuccessToast(
        t('message.pipeline-deployed-successfully', {
          pipelineName: getEntityName(pipeline),
        })
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.pipeline'),
        })
      );
    }
  };

  const createTestSuiteWithPipeline = async (formData: BundleSuiteFormData) => {
    const testSuitePayload: CreateTestSuite = {
      name: formData.name,
      description: formData.description,
      owners: currentUser?.id
        ? [{ id: currentUser.id, type: OwnerType.USER }]
        : [],
    };

    const testSuite = await createTestSuites(testSuitePayload);

    await addTestCaseToLogicalTestSuite({
      testCaseIds: selectedTestCases.map((testCase) => testCase.id ?? ''),
      testSuiteId: testSuite.id ?? '',
    });

    if (formData.cron) {
      await createAndDeployPipeline(testSuite, formData);
    }

    return testSuite;
  };

  const handleFormSubmit = async (values: BundleSuiteFormData) => {
    setIsSubmitting(true);
    try {
      const formData = {
        ...values,
        testCases: selectedTestCases,
      };

      const testSuite = await createTestSuiteWithPipeline(formData);

      onSuccess?.(testSuite);

      showSuccessToast(
        t('message.entity-created-successfully', {
          entity: t('label.test-suite'),
        })
      );

      if (isDrawer) {
        onCancel?.();
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.test-suite'),
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  const renderActionButtons = (
    <Space size={16}>
      <Button data-testid="cancel-button" onClick={handleCancel}>
        {t('label.cancel')}
      </Button>
      <Button
        data-testid="submit-button"
        form="bundle-suite-form"
        htmlType="submit"
        loading={isSubmitting}
        type="primary">
        {t('label.create')}
      </Button>
    </Space>
  );

  const formContent = (
    <div
      className={classNames(
        'bundle-suite-form',
        {
          'drawer-mode': isDrawer,
          'standalone-mode': !isDrawer,
        },
        className
      )}>
      <Form
        form={form}
        id="bundle-suite-form"
        initialValues={{
          raiseOnError: true,
          cron: DEFAULT_SCHEDULE_CRON_DAILY,
          enableDebugLog: false,
          ...initialValues,
        }}
        layout="vertical"
        onFinish={handleFormSubmit}>
        {!isDrawer && (
          <Typography.Title level={4}>
            {t('label.create-entity', { entity: t('label.bundle-suite') })}
          </Typography.Title>
        )}

        {/* Basic Information */}
        <Card className="basic-info-card">
          {generateFormFields(basicInfoFormFields)}
        </Card>

        {/* Test Case Selection */}
        <Card className="test-case-selection-card">
          <Form.Item
            label={t('label.test-case-plural')}
            name="testCases"
            rules={[
              {
                required: true,
                message: t('label.field-required', {
                  field: t('label.test-case-plural'),
                }),
              },
            ]}>
            <AddTestCaseList
              selectedTest={selectedTestCases.map((tc) => tc.name)}
              showButton={false}
              onChange={handleTestCaseSelection}
            />
          </Form.Item>
        </Card>

        {/* Scheduler - Always Visible */}
        <Card className="scheduler-card">
          <div className="card-title">
            {t('label.schedule-for-entity', {
              entity: t('label.test-suite'),
            })}
          </div>

          {generateFormFields(schedulerFormFields)}

          <Form.Item label={t('label.schedule-interval')} name="cron">
            <ScheduleIntervalV1 includePeriodOptions={schedulerOptions} />
          </Form.Item>

          {/* Debug Log and Raise on Error switches */}
          <div style={{ marginTop: '24px' }}>
            <Row gutter={[24, 16]}>
              <Col span={12}>
                <div className="d-flex justify-between align-center">
                  <Typography.Text className="font-medium">
                    {t('label.enable-debug-log')}
                  </Typography.Text>
                  <Form.Item
                    name="enableDebugLog"
                    style={{ marginBottom: 0 }}
                    valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </div>
              </Col>
              <Col span={12}>
                <div className="d-flex justify-between align-center">
                  <Typography.Text className="font-medium">
                    {t('label.raise-on-error')}
                  </Typography.Text>
                  <Form.Item
                    name="raiseOnError"
                    style={{ marginBottom: 0 }}
                    valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </div>
              </Col>
            </Row>
          </div>
        </Card>
      </Form>

      {!isDrawer && (
        <div className="bundle-suite-form-actions">{renderActionButtons}</div>
      )}
    </div>
  );

  const drawerFooter = (
    <div className="drawer-footer-actions">{renderActionButtons}</div>
  );

  if (isDrawer) {
    return (
      <Drawer
        destroyOnClose
        closable={false}
        footer={drawerFooter}
        maskClosable={false}
        placement="right"
        size="large"
        {...drawerProps}
        onClose={onCancel}>
        <div className="drawer-form-content">{formContent}</div>
      </Drawer>
    );
  }

  return formContent;
};

export default BundleSuiteForm;
