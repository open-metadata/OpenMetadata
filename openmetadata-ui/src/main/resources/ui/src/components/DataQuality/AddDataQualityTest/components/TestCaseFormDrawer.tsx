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
import { Lightbulb05 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { TFunction } from 'i18next';
import { isEmpty } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { TestCase } from '../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
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
import { monospaceParameterNames } from '../../../../utils/DataQuality/FormHintDocUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { submitAndClose } from '../../../../utils/FormDrawerUtils';
import { createScrollToErrorHandler } from '../../../../utils/formPureUtils';
import { omitInapplicableDimensionParams } from '../../../../utils/observability/data-quality/testCaseThreshold.utils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import { useFormDrawerWithHook } from '../../../common/atoms/drawer/useFormDrawer';
import Loader from '../../../common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
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

const getResolvedDrawerWidth = (
  width: number | string | undefined,
  showDocPanel: boolean
): number | string => width ?? (showDocPanel ? '80vw' : '52vw');

const getDefaultDrawerTitle = (
  isEditMode: boolean,
  testCase: TestCase | undefined,
  t: TFunction
): string =>
  isEditMode
    ? t('label.edit-entity', { entity: getEntityName(testCase) })
    : t('label.add-entity', { entity: t('label.test-case') });

const getIsEditPrefilling = (
  isEditMode: boolean,
  open: boolean,
  editPrefilledId: string | undefined,
  testCaseId: string | undefined
): boolean => isEditMode && open && editPrefilledId !== testCaseId;

const TestCaseFormDrawer: FC<TestCaseFormDrawerProps> = ({
  open,
  onClose,
  onFormSubmit,
  onActiveFieldChange,
  table,
  testSuite,
  testLevel,
  title,
  headerActions,
  width,
  showDocPanel = true,
  testCase,
  showOnlyParameter = false,
  onUpdate,
}: TestCaseFormDrawerProps) => {
  const { t } = useTranslation();
  const { getResourceLimit } = useLimitStore();
  const { isAirflowAvailable } = useAirflowStatus();
  const { permissions } = usePermissionProvider();
  const { ingestionPipeline } = permissions;
  // Resource-level permission (usePermissionProvider().permissions.ingestionPipeline) —
  // itself OperationPermission-shaped, so it runs through getDerivedPermissionFlags exactly
  // like an entity-level fetch (Task 8 Batch 3 DatabaseSchemaTable.tsx precedent).
  const ingestionPipelineFlags = useMemo(
    () => getDerivedPermissionFlags(ingestionPipeline),
    [ingestionPipeline]
  );

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

  const createTestCasePipeline = useCallback(
    async (values: FormValues, created: TestCase) => {
      const pipelineTestSuite = created.testSuite ?? testSuite;
      if (!formContext?.canCreatePipeline || !pipelineTestSuite) {
        return;
      }

      const pipeline = buildTestSuitePipelinePayload(values, {
        testSuite: pipelineTestSuite,
        createdTestCaseName: created.name,
        // Prefer the raw form FQN: `canCreatePipeline` is gated on it, so it can
        // be submitted while `selectedTableData` is still being fetched.
        selectedTable:
          formContext?.selectedTableFqn ??
          formContext?.selectedTableData?.fullyQualifiedName,
        table,
      });

      const ingestion = await addIngestionPipeline(pipeline);
      if (isAirflowAvailable && ingestionPipelineFlags.canEditAll) {
        await deployIngestionPipelineById(ingestion.id ?? '');
      }
    },
    [formContext, testSuite, table, isAirflowAvailable, ingestionPipelineFlags]
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
      normalizedValues.params = omitInapplicableDimensionParams(
        normalizedValues.params,
        !isEmpty(normalizedValues.dimensionColumns)
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
        // The dimension field is prefilled with the definition's dimension when
        // the test case has none of its own, so the patch needs it to tell that
        // prefill apart from a dimension the user actually picked.
        inheritedDimension: resolvedDefinition?.dataQualityDimension,
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
        // `resolveEntityLink` falls back to '' when every source is empty, so
        // this must also prefer the raw form FQN over the fetched table.
        selectedTable:
          formContext?.selectedTableFqn ??
          formContext?.selectedTableData?.fullyQualifiedName,
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

  const testCaseFormBody = (
    <TestCaseFormBody
      editDefinition={editDefinition}
      errorMessage={errorMessage}
      form={form}
      isEditMode={isEditMode}
      showOnlyParameter={showOnlyParameter}
      table={table}
      testSuite={testSuite}
      onActiveFieldChange={onActiveFieldChange}
      onContextChange={setFormContext}
      onErrorDismiss={handleErrorDismiss}
    />
  );

  // Without the hint the form spans the full drawer, so drop the drawer width
  // to roughly the form's original 65% column and let it fill.
  const resolvedWidth = getResolvedDrawerWidth(width, showDocPanel);

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
  const isEditPrefilling = getIsEditPrefilling(
    isEditMode,
    open,
    editPrefilledId,
    testCase?.id
  );

  const gatedFormBody = isEditPrefilling ? (
    <div className="tw:flex tw:items-center tw:justify-center tw:py-16">
      <Loader />
    </div>
  ) : (
    testCaseFormBody
  );

  const closeDrawerRef = useRef<() => void>(() => undefined);

  const formBody = (
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
          <Lightbulb05 aria-hidden className="tw:size-4 tw:text-secondary" />
          <Typography
            className="tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.form-hint')}
          </Typography>
        </Box>
      }
      form={form}
      // The drawer body's own padding is zeroed (see `body` below) so the
      // hint column runs edge to edge; the form column carries it instead.
      // `drawer-form-content` marks this column as the scroll-to-error target,
      // since it, not the drawer body, is what scrolls.
      formClassName="drawer-form-content tw:px-4 tw:py-6 tw:md:px-6"
      renderFieldDoc={(markdown) => (
        // Render the full field doc without the "see more" toggle — the
        // column scrolls, so the whole hint is reachable without it.
        <div className="form-hint-doc">
          <RichTextEditorPreviewerV1
            enableSeeMoreVariant={false}
            markdown={monospaceParameterNames(markdown)}
          />
        </div>
      )}
      showFieldDocs={showDocPanel && showHint}
      onSubmit={form.handleSubmit(
        (data) =>
          submitAndClose(data, handleSubmit, () => closeDrawerRef.current()),
        () => scrollToError()
      )}>
      {gatedFormBody}
    </HookForm>
  );

  // pr-10 keeps the toggle clear of the header's absolutely-positioned close
  // button.
  const hintToggle = (
    <Box align="center" className="tw:gap-2 tw:pr-10" direction="row">
      <Lightbulb05 aria-hidden className="tw:size-4 tw:text-secondary" />
      <Typography
        className="tw:whitespace-nowrap tw:text-secondary"
        size="text-sm"
        weight="medium">
        {t('label.show-hint')}
      </Typography>
      <Toggle
        aria-label={t('label.show-hint')}
        data-testid="show-hint-toggle"
        isSelected={showHint}
        size="sm"
        onChange={setShowHint}
      />
    </Box>
  );

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

  const defaultTitle = getDefaultDrawerTitle(isEditMode, testCase, t);
  const resolvedTitle = title ?? defaultTitle;

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<FormValues>({
      className: 'test-case-form-drawer',
      title: resolvedTitle,
      hookForm: form,
      form: formBody,
      headerActions: showDocPanel ? (
        <>
          {headerActions}
          {hintToggle}
        </>
      ) : (
        headerActions
      ),
      // Each panel column scrolls on its own, so the body must not pad, gap
      // or stack them. tailwind-merge drops the SlideoutMenu.Content defaults
      // these conflict with (`px-4 md:px-6`, `gap-6`, `flex-col`).
      body: { className: 'tw:flex-row tw:gap-0 tw:px-0 tw:md:px-0' },
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
    if (open) {
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [open, isOpen, openDrawer, closeDrawer]);

  return formDrawer;
};

export default TestCaseFormDrawer;
