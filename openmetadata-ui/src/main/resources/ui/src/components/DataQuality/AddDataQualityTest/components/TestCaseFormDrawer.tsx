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
  EmptyPlaceholder,
  HookForm,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Lightbulb05 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { TableSearchSource } from '../../../../interface/search.interface';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import {
  createTestCase,
  getTestDefinitionById,
  updateTestCaseById,
} from '../../../../rest/testAPI';
import { createUpdatedTestCasePatch } from '../../../../utils/DataQuality/DataQualityPureUtils';
import { getDefaultTestCaseFormVariant } from '../../../../utils/DataQuality/TestCaseFormVariantUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { submitAndClose } from '../../../../utils/FormDrawerUtils';
import { createScrollToErrorHandler } from '../../../../utils/formPureUtils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import { AiFormModal } from '../../../common/atoms/drawer/AiFormModal';
import { useFormDrawerWithHook } from '../../../common/atoms/drawer/useFormDrawer';
import Loader from '../../../common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import { TestCaseFormType } from '../AddDataQualityTest.interface';
import TestCaseFormBody from './TestCaseFormBody';
import {
  FormValues,
  TestCaseFormContext,
  TestCaseFormDrawerProps,
  TestLevel,
} from './TestCaseFormV1.interface';
import './TestCaseFormV1.less';
import {
  buildEditDefaults,
  buildTestSuitePipelinePayload,
  normalizeFormValuesForPayload,
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
  variant = getDefaultTestCaseFormVariant(),
  title,
  headerActions,
  width,
  showDocPanel = variant === 'drawer',
  testCase,
  showOnlyParameter = false,
  onUpdate,
}: TestCaseFormDrawerProps) => {
  const { t } = useTranslation();
  const { getResourceLimit } = useLimitStore();
  const { isAirflowAvailable } = useAirflowStatus();
  const { permissions } = usePermissionProvider();
  const { ingestionPipeline } = permissions;

  const isEditMode = !!testCase;

  const form = useForm<FormValues>({
    // Legacy antd validated fields on change (name regex/uniqueness errors
    // surface while typing); mirror that instead of RHF's submit-time default.
    mode: 'onChange',
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
  const [editDefinition, setEditDefinition] = useState<TestDefinition>();
  // Id of the test case whose edit prefill has finished. Until this matches the
  // open test case, the body renders a loader so the form appears fully
  // populated in one paint instead of filling in as the async prefill lands.
  const [editPrefilledId, setEditPrefilledId] = useState<string>();

  const handleErrorDismiss = useCallback(() => setErrorMessage(''), []);

  useEffect(() => {
    if (!testCase || !open) {
      return undefined;
    }
    // Guard against a stale prefill: if the drawer closes (or reopens for a
    // different test case) while this fetch is in flight, its late result must
    // not reset the form out from under the current contents.
    let cancelled = false;
    (async () => {
      try {
        const definition = await getTestDefinitionById(
          testCase.testDefinition?.id ?? ''
        );
        if (cancelled) {
          return;
        }
        setEditDefinition(definition);
        form.reset({
          ...form.getValues(),
          ...buildEditDefaults(testCase, definition),
        } as FormValues);
      } finally {
        // Release the loader even if the definition fetch fails, so the drawer
        // never gets stuck on the spinner.
        if (!cancelled) {
          setEditPrefilledId(testCase.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [testCase, open, form]);

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

  const handleEditSubmit = useCallback(
    async (values: FormValues) => {
      // `editDefinition` comes from the direct getTestDefinitionById fetch in
      // the prefill effect, which is keyed by the test case's own definition
      // id. `formContext.selectedDefinition` is resolved by TestCaseFormBody
      // from its filtered getListTestDefinitions list, which can be
      // undefined on a submit-before-load race or when the definition is
      // filtered out (deprecated/mismatched service or data type). Prefer
      // the directly-fetched definition so Array-type params are always
      // correctly serialized.
      const resolvedDefinition =
        editDefinition ?? formContext?.selectedDefinition;
      const isComputeRowCountFieldVisible =
        resolvedDefinition?.supportsRowLevelPassedFailed ?? false;
      // Edit prefill (`buildEditDefaults`) stores select-type params and
      // `dimensionColumns` as `FormSelectItem` shapes so the fields display
      // correctly, exactly like the create path's raw RHF values. Both
      // submit paths MUST run through the same normalizer before building
      // their payload/patch, or this one emits objects/dotted keys instead
      // of ids/paths — see `transformTestCaseFormData` (create).
      const normalizedValues = normalizeFormValuesForPayload(
        values,
        resolvedDefinition
      );
      const formValue = normalizedValues as unknown as TestCaseFormType;
      const jsonPatch = createUpdatedTestCasePatch({
        testCase: testCase as TestCase,
        value: formValue,
        createTestCaseObject: testCaseClassBase.getCreateTestCaseObject(
          formValue,
          resolvedDefinition
        ),
        showOnlyParameter,
        isComputeRowCountFieldVisible,
      });

      if (!jsonPatch.length) {
        return;
      }

      const updated = await updateTestCaseById(
        (testCase as TestCase).id ?? '',
        jsonPatch
      );
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.test-case') })
      );
      onUpdate?.(updated);
    },
    [testCase, editDefinition, formContext, showOnlyParameter, onUpdate, t]
  );

  const handleCreateSubmit = useCallback(
    async (values: FormValues) => {
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

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      setErrorMessage('');
      try {
        if (isEditMode) {
          await handleEditSubmit(values);
        } else {
          await handleCreateSubmit(values);
        }
      } catch (error) {
        const errorMsg =
          (error as AxiosError<{ message: string }>)?.response?.data?.message ||
          t(
            isEditMode
              ? 'server.update-entity-error'
              : 'server.create-entity-error',
            { entity: t('label.test-case') }
          );
        setErrorMessage(errorMsg);

        throw error;
      }
    },
    [isEditMode, handleEditSubmit, handleCreateSubmit, t]
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
      editDefinition={editDefinition}
      errorMessage={errorMessage}
      form={form}
      isEditMode={isEditMode}
      showOnlyParameter={showOnlyParameter}
      table={table}
      testSuite={testSuite}
      onActiveFieldChange={handleActiveFieldChange}
      onContextChange={setFormContext}
      onErrorDismiss={handleErrorDismiss}
    />
  );

  const isModalVariant = variant === 'modal';

  const docPanel = showDocPanel ? (
    <div className="drawer-doc-panel service-doc-panel markdown-parser">
      {serviceDocPanel}
    </div>
  ) : null;

  // Without the doc panel the form spans the full drawer, so drop the drawer
  // width to roughly the form's original 65% column and let it fill (see the
  // .no-doc-panel grid override in TestCaseFormV1.less).
  const resolvedWidth = width ?? (showDocPanel ? '80vw' : '52vw');

  const scrollToError = useMemo(
    () =>
      createScrollToErrorHandler({
        errorSelector: '[aria-invalid="true"], [data-invalid="true"]',
      }),
    []
  );

  // In edit mode hold the form behind a loader until the prefill (definition
  // fetch + form.reset) is done for the open test case, so it renders fully
  // populated in one paint rather than flickering values in as calls resolve.
  const isEditPrefilling =
    isEditMode && open && editPrefilledId !== testCase?.id;

  const gatedFormBody = isEditPrefilling ? (
    <div className="tw:flex tw:items-center tw:justify-center tw:py-16">
      <Loader />
    </div>
  ) : (
    testCaseFormBody
  );

  const formBody = (
    <HookForm
      form={form}
      onSubmit={form.handleSubmit(
        (data) =>
          submitAndClose(data, handleSubmit, () => closeDrawerRef.current()),
        () => scrollToError()
      )}>
      <div
        className={`drawer-content-wrapper${
          showDocPanel ? '' : ' no-doc-panel'
        }`}>
        <div className="drawer-form-content">{gatedFormBody}</div>
        {docPanel}
      </div>
    </HookForm>
  );

  const closeDrawerRef = useRef<() => void>(() => undefined);

  // Every dismissal path (cancel, X, Escape, backdrop, programmatic close)
  // funnels through the base drawer's onClose, so the parent is notified
  // exactly once and the form resets. The backdrop stays dismissable to match
  // the legacy antd drawer (only the bundle suite drawer was mask-locked).
  const handleDrawerDismiss = useCallback(() => {
    form.reset();
    // Force the loader again on the next open so a reopened drawer never shows
    // the previous (or empty) form before its prefill lands.
    setEditPrefilledId(undefined);
    onClose();
  }, [form, onClose]);

  const defaultTitle = isEditMode
    ? t('label.edit-entity', { entity: getEntityName(testCase) })
    : t('label.add-entity', { entity: t('label.test-case') });

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<FormValues>({
      className: 'test-case-form-drawer',
      title: title ?? defaultTitle,
      hookForm: form,
      form: formBody,
      headerActions,
      width: resolvedWidth,
      submitLabel: isEditMode ? t('label.update') : t('label.create'),
      submitTestId: 'create-btn',
      submitLoading: formContext?.isCheckingPermissions ?? false,
      onClose: handleDrawerDismiss,
      onSubmit: (data) =>
        submitAndClose(data, handleSubmit, () => closeDrawerRef.current()),
    });

  closeDrawerRef.current = closeDrawer;

  useEffect(() => {
    if (isModalVariant) {
      return;
    }
    if (open) {
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [isModalVariant, open, isOpen, openDrawer, closeDrawer]);

  if (isModalVariant) {
    return (
      <AiFormModal
        headerActions={
          headerActions ?? (
            <Box align="center" className="tw:gap-2" direction="row">
              <Lightbulb05 className="tw:size-4 tw:text-secondary" />
              <Typography
                className="tw:text-secondary"
                size="text-sm"
                weight="medium">
                {t('label.show-hint')}
              </Typography>
              <Toggle
                aria-label={t('label.show-hint')}
                isSelected={showHint}
                size="sm"
                onChange={setShowHint}
              />
            </Box>
          )
        }
        hintOpen={showHint}
        isSubmitting={form.formState.isSubmitting}
        open={open}
        submitLabel={isEditMode ? t('label.update') : undefined}
        subtitle={t('message.page-sub-header-for-data-quality')}
        title={title ?? defaultTitle}
        onClose={handleDrawerDismiss}
        onSubmit={form.handleSubmit(
          (data) => submitAndClose(data, handleSubmit, handleDrawerDismiss),
          () => scrollToError()
        )}>
        <HookForm
          emptyFieldDoc={
            // width="100%" is required: EmptyPlaceholder's 300px default is
            // wider than the hint column's 260px minimum and would overflow
            // once the column shrinks on a narrow viewport.
            <EmptyPlaceholder
              description={t('message.form-hint-empty-state')}
              icon={Lightbulb05}
              title={t('label.no-entity-selected', {
                entity: t('label.field'),
              })}
              width="100%"
            />
          }
          fieldDocDisplay="panel"
          fieldDocHeader={
            <Box align="center" className="tw:gap-2" direction="row">
              <Lightbulb05 className="tw:size-4 tw:text-secondary" />
              <Typography
                className="tw:text-secondary"
                size="text-sm"
                weight="medium">
                {t('label.form-hint')}
              </Typography>
            </Box>
          }
          form={form}
          // min-w-193 (772px) overrides HookForm's 380px default: this form's
          // test-level cards need ~574px before they clip, so a lower floor
          // lets the hint steal room the form cannot spare.
          formClassName="tw:min-w-193 tw:px-7 tw:pt-6 tw:pb-7"
          renderFieldDoc={(markdown) => (
            // Render the full field doc without the "see more" toggle — the
            // column scrolls, so the whole hint is reachable without it.
            <div className="form-hint-doc">
              <RichTextEditorPreviewerV1
                enableSeeMoreVariant={false}
                markdown={markdown}
              />
            </div>
          )}
          showFieldDocs={showHint}
          onSubmit={form.handleSubmit(
            (data) => submitAndClose(data, handleSubmit, handleDrawerDismiss),
            () => scrollToError()
          )}>
          {gatedFormBody}
        </HookForm>
      </AiFormModal>
    );
  }

  return formDrawer;
};

export default TestCaseFormDrawer;
