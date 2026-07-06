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
import {
  Box,
  FeaturedIcon,
  HookForm,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Lightbulb02 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import {
  OPEN_METADATA,
  TEST_CASE_FORM,
} from '../../../../constants/service-guide.constant';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityType as EntityTypeEnum } from '../../../../enums/entity.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { TestCase } from '../../../../generated/tests/testCase';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { TableSearchSource } from '../../../../interface/search.interface';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import { createTestCase } from '../../../../rest/testAPI';
import { submitAndClose } from '../../../../utils/FormDrawerUtils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import { AiFormModal } from '../../../common/atoms/drawer/AiFormModal';
import { useFormDrawerWithHook } from '../../../common/atoms/drawer/useFormDrawer';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import TestCaseFormBody from './TestCaseFormBody';
import {
  FormValues,
  TestCaseFormContext,
  TestCaseFormDrawerProps,
  TestLevel,
} from './TestCaseFormV1.interface';
import './TestCaseFormV1.less';
import {
  buildTestSuitePipelinePayload,
  transformTestCaseFormData,
} from './transformTestCaseFormData';

const TestCaseFormDrawer: FC<TestCaseFormDrawerProps> = ({
  open,
  onClose,
  onFormSubmit,
  onActiveFieldChange,
  table,
  testSuite,
  testLevel,
  variant = 'classic',
  title,
  headerActions,
  width = '80vw',
  showDocPanel = variant === 'classic',
}: TestCaseFormDrawerProps) => {
  const { t } = useTranslation();
  const { getResourceLimit } = useLimitStore();
  const { isAirflowAvailable } = useAirflowStatus();
  const { permissions } = usePermissionProvider();
  const { ingestionPipeline } = permissions;

  const form = useForm<FormValues>({
    defaultValues: {
      testLevel: testLevel ?? TestLevel.TABLE,
      useDynamicAssertion: false,
      ...testCaseClassBase.initialFormValues(),
      cron: DEFAULT_SCHEDULE_CRON_DAILY,
      enableDebugLog: false,
      raiseOnError: true,
      selectAllTestCases: true,
      selectedTable: table?.fullyQualifiedName,
    } as FormValues,
  });

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeField, setActiveField] = useState<string>('');
  const [formContext, setFormContext] = useState<TestCaseFormContext>();
  const [showHint, setShowHint] = useState<boolean>(true);

  const handleErrorDismiss = useCallback(() => setErrorMessage(''), []);

  const handleActiveFieldChange = useCallback(
    (fieldId: string) => {
      setActiveField(fieldId);
      onActiveFieldChange?.(fieldId);
    },
    [onActiveFieldChange]
  );

  const createTestCasePipeline = useCallback(
    async (values: FormValues, created: TestCase) => {
      const pipelineTestSuite =
        (created.testSuite as TestSuite | undefined) ?? testSuite;
      if (!formContext?.canCreatePipeline || !pipelineTestSuite) {
        return;
      }

      const pipeline = buildTestSuitePipelinePayload(values, {
        testSuite: pipelineTestSuite,
        createdTestCaseName: created.name,
        selectedTable: formContext?.selectedTableData?.fullyQualifiedName,
        table,
      });

      const ingestion = await addIngestionPipeline(pipeline);
      if (isAirflowAvailable && ingestionPipeline.EditAll) {
        await deployIngestionPipelineById(ingestion.id ?? '');
      }
    },
    [formContext, testSuite, table, isAirflowAvailable, ingestionPipeline]
  );

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      setErrorMessage('');
      try {
        const testCaseObj = transformTestCaseFormData(values, {
          selectedDefinition: formContext?.selectedDefinition,
          selectedTableData: formContext?.selectedTableData,
          selectedColumn: formContext?.selectedColumn,
          selectedTestLevel: formContext?.selectedTestLevel ?? TestLevel.TABLE,
          table,
          selectedTable: formContext?.selectedTableData?.fullyQualifiedName,
          generateName: formContext?.generateName ?? (() => ''),
        });

        const created = await createTestCase(testCaseObj);
        await getResourceLimit('dataQuality', true, true);
        await createTestCasePipeline(values, created);

        showSuccessToast(
          t('server.create-entity-success', { entity: t('label.test-case') })
        );

        onFormSubmit?.(created);
      } catch (error) {
        const errorMsg =
          (error as AxiosError<{ message: string }>)?.response?.data?.message ||
          t('server.create-entity-error', { entity: t('label.test-case') });
        setErrorMessage(errorMsg);

        throw error;
      }
    },
    [
      formContext,
      table,
      getResourceLimit,
      createTestCasePipeline,
      onFormSubmit,
      t,
    ]
  );

  const serviceDocPanel = (
    <ServiceDocPanel
      activeField={activeField}
      selectedEntity={
        isUndefined(formContext?.selectedTableData)
          ? undefined
          : ({
              ...formContext?.selectedTableData,
              entityType: EntityTypeEnum.TABLE,
            } as TableSearchSource)
      }
      serviceName={TEST_CASE_FORM}
      serviceType={OPEN_METADATA as ServiceCategory}
    />
  );

  const testCaseFormBody = (
    <TestCaseFormBody
      errorMessage={errorMessage}
      form={form}
      table={table}
      testSuite={testSuite}
      onActiveFieldChange={handleActiveFieldChange}
      onContextChange={setFormContext}
      onErrorDismiss={handleErrorDismiss}
    />
  );

  const isAiVariant = variant === 'ai';

  const docPanel = showDocPanel ? (
    <div className="drawer-doc-panel service-doc-panel markdown-parser">
      {serviceDocPanel}
    </div>
  ) : null;

  const formBody = (
    <HookForm
      form={form}
      onSubmit={form.handleSubmit((data) =>
        submitAndClose(data, handleSubmit, () => closeDrawerRef.current())
      )}>
      <div className="drawer-content-wrapper">
        <div className="drawer-form-content">{testCaseFormBody}</div>
        {docPanel}
      </div>
    </HookForm>
  );

  const closeDrawerRef = useRef<() => void>(() => undefined);

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<FormValues>({
      className: 'test-case-form-drawer',
      title: title ?? t('label.add-entity', { entity: t('label.test-case') }),
      hookForm: form,
      form: formBody,
      headerActions,
      width,
      submitLabel: t('label.create'),
      onCancel: onClose,
      onSubmit: (data) =>
        submitAndClose(data, handleSubmit, () => closeDrawerRef.current()),
    });

  closeDrawerRef.current = closeDrawer;

  useEffect(() => {
    if (isAiVariant) {
      return;
    }
    if (open) {
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [isAiVariant, open, isOpen, openDrawer, closeDrawer]);

  if (isAiVariant) {
    const aiHint = showHint ? (
      // 366px hint card floats to the right of the centered modal (Figma).
      <Box
        className="tw:w-[366px] tw:shrink-0 tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:shadow-lg"
        data-testid="test-case-form-hint"
        direction="col">
        <Box
          align="center"
          className="tw:gap-3 tw:border-b tw:border-secondary tw:px-4 tw:py-3"
          direction="row">
          <FeaturedIcon
            color="brand"
            icon={Lightbulb02}
            radius="md"
            shape="square"
            size="sm"
            theme="light"
          />
          <Typography size="text-sm" weight="semibold">
            {t('label.form-hint')}
          </Typography>
        </Box>
        <Box className="tw:px-4 tw:py-3 service-doc-panel markdown-parser">
          {serviceDocPanel}
        </Box>
      </Box>
    ) : undefined;

    return (
      <AiFormModal
        headerActions={
          headerActions ?? (
            <Toggle
              isSelected={showHint}
              label={t('label.show-hint')}
              size="sm"
              onChange={setShowHint}
            />
          )
        }
        hint={aiHint}
        open={open}
        subtitle={t('message.page-sub-header-for-data-quality')}
        title={title ?? t('label.add-entity', { entity: t('label.test-case') })}
        onClose={onClose}
        onSubmit={form.handleSubmit((data) =>
          submitAndClose(data, handleSubmit, onClose)
        )}>
        <HookForm
          form={form}
          onSubmit={form.handleSubmit((data) =>
            submitAndClose(data, handleSubmit, onClose)
          )}>
          {testCaseFormBody}
        </HookForm>
      </AiFormModal>
    );
  }

  return formDrawer;
};

export default TestCaseFormDrawer;
