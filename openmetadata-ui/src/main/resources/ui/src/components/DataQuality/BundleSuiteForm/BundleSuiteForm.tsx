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
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg';
import { MAX_NAME_LENGTH } from '../../../constants/constants';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../constants/Schedular.constants';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
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
import AlertBar from '../../AlertBar/AlertBar';
import ScheduleIntervalV1 from '../../Settings/Services/AddIngestion/Steps/ScheduleIntervalV1';
import '../AddDataQualityTest/components/TestCaseFormV1.less';
import { AddTestCaseList } from '../AddTestCaseList/AddTestCaseList.component';
import {
  BundleSuiteFormData,
  BundleSuiteFormProps,
} from './BundleSuiteForm.interface';

// =============================================
// MAIN COMPONENT
// =============================================
const BundleSuiteForm: React.FC<BundleSuiteFormProps> = ({
  className,
  drawerProps,
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
  const { permissions } = usePermissionProvider();
  const { ingestionPipeline } = permissions;
  const enableScheduler = Form.useWatch('enableScheduler', form);

  // =============================================
  // HOOKS - State
  // =============================================
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
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
            max: MAX_NAME_LENGTH,
            message: t('message.entity-maximum-size', {
              entity: t('label.name'),
              max: MAX_NAME_LENGTH,
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

    if (formData.enableScheduler && ingestionPipeline.Create) {
      await createAndDeployPipeline(testSuite, formData);
    }

    return testSuite;
  };

  const handleFormSubmit = async (values: BundleSuiteFormData) => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const formData = {
        ...values,
        testCases: selectedTestCases,
      };

      const testSuite = await createTestSuiteWithPipeline(formData);

      onSuccess?.(testSuite);

      showSuccessToast(
        t('server.create-entity-success', {
          entity: t('label.test-suite'),
        })
      );

      onCancel?.();
    } catch (error) {
      // Show inline error alert for drawer mode
      const errorMsg =
        (error as AxiosError<{ message: string }>)?.response?.data?.message ||
        t('server.create-entity-error', {
          entity: t('label.test-suite'),
        });
      setErrorMessage(errorMsg);
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
      <Button data-testid="cancel-button" type="link" onClick={handleCancel}>
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
    <div className={classNames('bundle-suite-form drawer-mode', className)}>
      {/* Floating Error Alert - always visible at top */}
      {errorMessage && (
        <div className="floating-error-alert">
          <AlertBar
            defafultExpand
            className="h-full custom-alert-description"
            message={errorMessage}
            type="error"
          />
        </div>
      )}

      <Form
        className="new-form-style"
        form={form}
        id="bundle-suite-form"
        initialValues={{
          enableScheduler: false,
          raiseOnError: true,
          cron: DEFAULT_SCHEDULE_CRON_DAILY,
          enableDebugLog: false,
          ...initialValues,
        }}
        layout="vertical"
        scrollToFirstError={{
          behavior: 'smooth',
          block: 'center',
          scrollMode: 'if-needed',
        }}
        onFinish={handleFormSubmit}>
        {/* Basic Information */}
        <Card className="form-card-section" data-testid="basic-info-card">
          {generateFormFields(basicInfoFormFields)}
        </Card>

        {/* Test Case Selection */}
        <Card
          className="form-card-section"
          data-testid="test-case-selection-card">
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

        {/* Scheduler with Toggle */}
        {ingestionPipeline.Create && (
          <Card className="form-card-section" data-testid="scheduler-card">
            <div className="card-title-container d-flex items-center gap-3 m-b-lg">
              <Form.Item
                noStyle
                className="m-b-0"
                name="enableScheduler"
                valuePropName="checked">
                <Switch data-testid="scheduler-toggle" />
              </Form.Item>
              <div>
                <Typography.Paragraph className="card-title-text m-0">
                  {t('label.create-entity', {
                    entity: t('label.pipeline'),
                  })}
                </Typography.Paragraph>
                <Typography.Paragraph className="card-title-description m-0">
                  {`${t('message.pipeline-entity-description', {
                    entity: t('label.bundle-suite'),
                  })} (${t('label.optional')})`}
                </Typography.Paragraph>
              </div>
            </div>

            {/* Scheduler form fields - only show when toggle is enabled */}
            {enableScheduler && (
              <>
                {generateFormFields(schedulerFormFields)}

                <Form.Item label={t('label.schedule-interval')} name="cron">
                  <ScheduleIntervalV1
                    entity={t('label.test-suite')}
                    includePeriodOptions={schedulerOptions}
                  />
                </Form.Item>

                {/* Debug Log and Raise on Error switches */}
                <div className="m-t-md">
                  <Row gutter={[24, 16]}>
                    <Col span={12}>
                      <div className="d-flex gap-2 form-switch-container">
                        <Form.Item
                          className="m-b-0"
                          name="enableDebugLog"
                          valuePropName="checked">
                          <Switch />
                        </Form.Item>
                        <Typography.Paragraph className="font-medium m-0">
                          {t('label.enable-debug-log')}
                        </Typography.Paragraph>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="d-flex gap-2 form-switch-container">
                        <Form.Item
                          className="m-b-0"
                          name="raiseOnError"
                          valuePropName="checked">
                          <Switch />
                        </Form.Item>
                        <Typography.Paragraph className="font-medium m-0">
                          {t('label.raise-on-error')}
                        </Typography.Paragraph>
                      </div>
                    </Col>
                  </Row>
                </div>
              </>
            )}
          </Card>
        )}
      </Form>
    </div>
  );

  const drawerFooter = (
    <div className="drawer-footer-actions">{renderActionButtons}</div>
  );

  return (
    <Drawer
      destroyOnClose
      className="custom-drawer-style"
      closable={false}
      footer={drawerFooter}
      maskClosable={false}
      placement="right"
      size="large"
      title={t('label.add-entity', {
        entity: t('label.bundle-suite'),
      })}
      {...drawerProps}
      extra={
        <Button
          className="drawer-close-icon flex-center"
          icon={<CloseIcon />}
          type="link"
          onClick={onCancel}
        />
      }
      onClose={onCancel}>
      <div className="drawer-form-content">{formContent}</div>
    </Drawer>
  );
};

export default BundleSuiteForm;
