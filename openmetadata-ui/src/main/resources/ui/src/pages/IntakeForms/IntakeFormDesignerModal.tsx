/*
 *  Copyright 2026 Collate.
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
  Alert,
  Box,
  Button,
  Select,
  SlideoutMenu,
  TextArea,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInRouterContext } from 'react-router-dom';
import { NavigationGuardModal } from '../../components/common/NavigationGuardModal/NavigationGuardModal';
import { OnboardingBuilderCheck } from '../../components/governance/onboarding/OnboardingBuilderCheck';
import { OnboardingCheckSettings } from '../../components/governance/onboarding/OnboardingCheckSettings';
import { OnboardingNavigationGuard } from '../../components/governance/onboarding/OnboardingNavigationGuard';
import { OnboardingPreview } from '../../components/governance/onboarding/OnboardingPreview';
import { CustomProperty } from '../../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  IntakeFormField,
  OnboardingGate,
  OnboardingStage,
  OnboardingStep,
  TargetEntityType,
  Type,
} from '../../generated/governance/intakeForm';
import { WorkflowDefinition } from '../../generated/governance/workflows/workflowDefinition';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getOnboardingWorkflow } from '../../rest/governance/onboarding/Onboarding.api';
import { getCustomPropertiesByEntityType } from '../../rest/metadataTypeAPI';
import { getWorkflowDefinitions } from '../../rest/workflowDefinitionsAPI';
import {
  CREATION_FIELDS,
  isRecord,
  ONBOARDING_STAGES,
  STAGE_LABELS,
  stepsAtStage,
} from '../../utils/governance/onboarding/Onboarding.utils';
import {
  onboardingRequiredCount,
  onboardingValueKind,
} from '../../utils/governance/onboarding/OnboardingBuilder.utils';
import {
  getIntakeFormFields,
  toLegacyRequiredFields,
} from '../../utils/IntakeFormUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import intakeFormClassBase from './IntakeFormClassBase';
import { IntakeFormDesignerModalProps } from './IntakeFormDesignerModal.interface';

const FIELD_LABELS: Record<string, string> = {
  domainType: 'domain-type',
  domains: 'domain-plural',
};
const ENTITY_LABELS: Record<TargetEntityType, string> = {
  dataProduct: 'data-product',
  glossaryTerm: 'glossary-term',
  domain: 'domain',
  metric: 'metric',
};
const compatibleWorkflow = (workflow: WorkflowDefinition) => {
  if (workflow.deployed === false || workflow.suspended) {
    return false;
  }
  if (!isRecord(workflow.trigger) || workflow.trigger.type !== 'noOp') {
    return false;
  }

  return (
    Boolean(
      workflow.nodes?.some((node) => node.subType === 'userApprovalTask')
    ) &&
    !workflow.nodes?.some((node) => node.subType === 'setEntityAttributeTask')
  );
};
const loadWorkflows = async () => {
  const workflows: WorkflowDefinition[] = [];
  let after: string | undefined;
  do {
    const response = await getWorkflowDefinitions({
      limit: 100,
      after,
      fields: 'deployed,suspended',
    });
    const candidates = response.data.flatMap((workflow) =>
      workflow.id && compatibleWorkflow(workflow)
        ? [getOnboardingWorkflow(workflow.id)]
        : []
    );
    const deployed = await Promise.all(candidates);
    workflows.push(
      ...deployed.filter(
        (workflow) => workflow.deployed && compatibleWorkflow(workflow)
      )
    );
    after = response.paging.after;
  } while (after);

  return workflows;
};
const replaceStep = (gates: OnboardingGate[], step: OnboardingStep) =>
  gates.map((gate) => ({
    ...gate,
    steps: gate.steps.map((existing) =>
      existing.id === step.id ? step : existing
    ),
  }));
const withoutStep = (gates: OnboardingGate[], id: string) =>
  gates.map((gate) => ({
    ...gate,
    steps: gate.steps.filter((step) => step.id !== id),
  }));
const movedStep = (
  gates: OnboardingGate[],
  step: OnboardingStep,
  stage: OnboardingStage
) =>
  withoutStep(gates, step.id).map((gate) =>
    gate.stage === stage ? { ...gate, steps: [...gate.steps, step] } : gate
  );
const IntakeFormDesignerModal = ({
  open,
  entityType,
  initialValue,
  onCancel,
  onSubmit,
}: IntakeFormDesignerModalProps) => {
  const { t } = useTranslation();
  const [fields, setFields] = useState<IntakeFormField[]>([]);
  const [gates, setGates] = useState<OnboardingGate[]>([]);
  const [stage, setStage] = useState(OnboardingStage.Creation);
  const [selectedId, setSelectedId] = useState<string>();
  const [newField, setNewField] = useState<string>();
  const [description, setDescription] = useState(
    initialValue?.description ?? ''
  );
  const [enabled, setEnabled] = useState(initialValue?.enabled ?? true);
  const [staged, setStaged] = useState(
    initialValue?.onboarding?.enabled ?? !initialValue
  );
  const [preview, setPreview] = useState(false);
  const currentUser = useApplicationStore((state) => state.currentUser);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<CustomProperty[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const controlsDisabled = loading || loadError;
  const initialConfig = useRef('');
  const [confirmClose, setConfirmClose] = useState(false);
  const inRouter = useInRouterContext();
  const dirty =
    Boolean(initialConfig.current) &&
    initialConfig.current !==
      JSON.stringify({ fields, gates, description, enabled, staged });
  const close = () => (dirty ? setConfirmClose(true) : onCancel());
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);

    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);

  useEffect(() => {
    const configured = getIntakeFormFields(initialValue);
    const intrinsic = CREATION_FIELDS[entityType]
      .filter((path) => !configured.some((field) => field.fieldPath === path))
      .map((path) => ({
        fieldPath: path,
        fieldLabel: t(`label.${FIELD_LABELS[path] ?? path}`),
        fieldKind: FieldKind.Native,
        required: true,
      }));
    const formFields = [...configured, ...intrinsic];
    setFields(formFields);
    const initialGates = ONBOARDING_STAGES.map((item) => ({
      stage: item,
      steps: stepsAtStage({ ...initialValue, formFields }, item),
    }));
    setGates(initialGates);
    initialConfig.current = JSON.stringify({
      fields: formFields,
      gates: initialGates,
      description: initialValue?.description ?? '',
      enabled: initialValue?.enabled ?? true,
      staged: initialValue?.onboarding?.enabled ?? !initialValue,
    });
  }, [entityType, initialValue, t]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    Promise.all([getCustomPropertiesByEntityType(entityType), loadWorkflows()])
      .then(([custom, response]) => {
        if (!active) {
          return;
        }
        setProperties(custom ?? []);
        setWorkflows(response);
      })
      .catch((error) => {
        if (active) {
          setLoadError(true);
          showErrorToast(error as AxiosError);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [entityType]);

  const catalog = useMemo(
    () => [
      ...intakeFormClassBase.getNativeFields(entityType).map((field) => ({
        fieldPath: field.path,
        fieldLabel: t(field.labelKey),
        fieldKind: FieldKind.Native,
      })),
      ...properties.map((property) => ({
        fieldPath: `extension.${property.name}`,
        fieldLabel: property.displayName ?? property.name,
        fieldKind: FieldKind.CustomProperty,
      })),
    ],
    [entityType, properties, t]
  );
  const steps = gates.find((gate) => gate.stage === stage)?.steps ?? [];
  const isCompletedStage =
    stage === OnboardingStage.Approved || stage === OnboardingStage.Deprecated;
  const selected = steps.find((step) => step.id === selectedId);
  const selectedField = fields.find(
    (field) => field.fieldPath === selected?.fieldPath
  );
  const fixed = Boolean(
    selected?.fieldPath &&
      CREATION_FIELDS[entityType].includes(selected.fieldPath)
  );
  const updateStep = (step: OnboardingStep) =>
    setGates((current) => replaceStep(current, step));
  const updateField = (field: IntakeFormField) =>
    setFields((current) =>
      current.map((existing) =>
        existing.fieldPath === field.fieldPath ? field : existing
      )
    );
  const moveStep = (target: OnboardingStage) => {
    if (!selected) {
      return;
    }
    setGates((current) => movedStep(current, selected, target));
    setStage(target);
  };
  const addStep = (type: Type) => {
    const field = catalog.find((item) => item.fieldPath === newField);
    if (type === Type.Field && !field) {
      return;
    }
    const step: OnboardingStep = {
      id: `step_${crypto.randomUUID()}`,
      type,
      title: type === Type.Approval ? t('label.approval') : field?.fieldLabel,
      fieldPath: type === Type.Field ? field?.fieldPath : undefined,
    };
    if (field && type === Type.Field) {
      setFields((current) => [
        ...current.filter((item) => item.fieldPath !== field.fieldPath),
        { ...field, required: false },
      ]);
    }
    setGates((current) =>
      current.map((gate) => ({
        ...gate,
        steps: gate.stage === stage ? [...gate.steps, step] : gate.steps,
      }))
    );
    setSelectedId(step.id);
    setNewField(undefined);
  };
  const removeStep = (step: OnboardingStep) => {
    setGates((current) => withoutStep(current, step.id));
    if (step.fieldPath) {
      setFields((current) =>
        current.filter((field) => field.fieldPath !== step.fieldPath)
      );
    }
    setSelectedId(undefined);
  };
  const reorder = (index: number, offset: number) => {
    const reordered = [...steps];
    [reordered[index], reordered[index + offset]] = [
      reordered[index + offset],
      reordered[index],
    ];
    setGates((current) =>
      current.map((gate) =>
        gate.stage === stage ? { ...gate, steps: reordered } : gate
      )
    );
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSubmit({
        name: initialValue?.name ?? `${entityType}IntakeForm`,
        displayName: initialValue?.displayName,
        description,
        enabled,
        entityType,
        owners: initialValue?.owners,
        formFields: fields,
        requiredFields: toLegacyRequiredFields(fields),
        onboarding: { enabled: staged, gates },
      });
    } finally {
      setSaving(false);
    }
  };
  const previewCreator = useMemo(
    () => ({
      id: currentUser?.id ?? 'preview-creator',
      type: 'user',
      name: currentUser?.name ?? t('label.onboarding-role-creator'),
      displayName: currentUser?.displayName,
    }),
    [currentUser, t]
  );
  const previewForm: IntakeForm = useMemo(
    () => ({
      ...initialValue,
      id: initialValue?.id ?? 'preview',
      name: initialValue?.name ?? entityType,
      entityType,
      enabled,
      formFields: fields,
      onboarding: { enabled: staged, gates },
    }),
    [initialValue, entityType, enabled, fields, staged, gates]
  );
  const missingWorkflow = gates.some((gate) =>
    gate.steps.some((step) => step.type === Type.Approval && !step.workflow)
  );

  const publishState = useMemo(
    () => ({
      disabled: controlsDisabled || missingWorkflow,
      loading: saving || loading,
      label: t(staged ? 'label.onboarding-publish' : 'label.save'),
    }),
    [controlsDisabled, missingWorkflow, saving, loading, staged, t]
  );

  return (
    <>
      <NavigationGuardModal
        isOpen={confirmClose}
        onLeave={onCancel}
        onStay={() => setConfirmClose(false)}
      />
      {inRouter && <OnboardingNavigationGuard dirty={dirty} />}
      <SlideoutMenu
        isDismissable
        isOpen={open}
        width="90%"
        onOpenChange={(isOpen) => !isOpen && close()}>
        {() => (
          <>
            <SlideoutMenu.Header onClose={close}>
              <Box className="tw:gap-2" direction="col">
                <Typography size="text-lg" weight="semibold">
                  {t('label.onboarding-intake-forms')}
                </Typography>
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t(`label.${ENTITY_LABELS[entityType]}`)}
                </Typography>
              </Box>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content data-testid="intake-form-designer-modal">
              <Box className="tw:gap-6" direction="col">
                <Box className="tw:gap-6" wrap="wrap">
                  <Toggle
                    isSelected={enabled}
                    label={t('label.enabled')}
                    onChange={setEnabled}
                  />
                  <Toggle
                    data-testid="onboarding-enabled"
                    isSelected={staged}
                    label={t('label.staged-onboarding')}
                    onChange={setStaged}
                  />
                  <Button
                    color="secondary"
                    data-testid="onboarding-preview-toggle"
                    onPress={() => {
                      setPreview((value) => !value);
                      if (!preview) {
                        setStage(OnboardingStage.Creation);
                      }
                    }}>
                    {t(preview ? 'label.edit' : 'label.producer-preview')}
                  </Button>
                </Box>
                {loadError && (
                  <Alert
                    title={t('message.onboarding-configuration-load-error')}
                    variant="error"
                  />
                )}
                <TextArea
                  label={t('label.description')}
                  value={description}
                  onChange={setDescription}
                />
                <nav aria-label={t('label.stage')}>
                  <Box gap={2} wrap="wrap">
                    {ONBOARDING_STAGES.map((item) => (
                      <Button
                        aria-current={stage === item ? 'step' : undefined}
                        className="tw:h-auto tw:min-w-32 tw:flex-1 tw:py-3"
                        color={stage === item ? 'primary' : 'secondary'}
                        data-testid={`onboarding-stage-${item}`}
                        key={item}
                        onPress={() => {
                          setStage(item);
                          setSelectedId(undefined);
                        }}>
                        <Box direction="col" gap={1}>
                          <Typography size="text-sm" weight="semibold">
                            {t(STAGE_LABELS[item])}
                          </Typography>
                          <Typography size="text-xs">
                            {t('message.onboarding-stage-checks', {
                              count:
                                gates.find((gate) => gate.stage === item)?.steps
                                  .length ?? 0,
                            })}
                          </Typography>
                          <Typography size="text-xs">
                            {t('label.required')}:{' '}
                            {onboardingRequiredCount(gates, fields, item)}
                          </Typography>
                        </Box>
                      </Button>
                    ))}
                  </Box>
                </nav>
                {preview ? (
                  <OnboardingPreview
                    creator={previewCreator}
                    form={previewForm}
                    properties={properties}
                    stage={stage}
                    workflows={workflows}
                    onStageChange={setStage}
                  />
                ) : (
                  <Box
                    align="start"
                    className="tw:gap-6 tw:flex-col tw:lg:flex-row">
                    <Box
                      className="tw:gap-3 tw:w-full tw:lg:w-1/2"
                      direction="col">
                      {!isCompletedStage && (
                        <Typography className="tw:text-tertiary" size="text-sm">
                          {t('message.onboarding-gate-exit')}
                        </Typography>
                      )}
                      {isCompletedStage && (
                        <Alert
                          title={t('message.onboarding-approved-complete')}
                          variant="success"
                        />
                      )}
                      {steps.map((step, index) => (
                        <OnboardingBuilderCheck
                          field={fields.find(
                            (field) => field.fieldPath === step.fieldPath
                          )}
                          fixed={Boolean(
                            step.fieldPath &&
                              CREATION_FIELDS[entityType].includes(
                                step.fieldPath
                              )
                          )}
                          index={index}
                          key={step.id}
                          selected={selectedId === step.id}
                          step={step}
                          total={steps.length}
                          onMove={(offset) => reorder(index, offset)}
                          onRemove={() => removeStep(step)}
                          onSelect={() => setSelectedId(step.id)}
                        />
                      ))}
                      {!isCompletedStage && (
                        <>
                          <Select
                            isDisabled={controlsDisabled}
                            label={t('label.field')}
                            selectedKey={newField}
                            onSelectionChange={(key) =>
                              setNewField(String(key))
                            }>
                            {catalog
                              .filter(
                                (field) =>
                                  !fields.some(
                                    (existing) =>
                                      existing.fieldPath === field.fieldPath
                                  )
                              )
                              .map((field) => (
                                <Select.Item
                                  id={field.fieldPath}
                                  key={field.fieldPath}
                                  label={field.fieldLabel}
                                />
                              ))}
                          </Select>
                          <Button
                            color="secondary"
                            iconLeading={Plus}
                            isDisabled={!newField}
                            onPress={() => addStep(Type.Field)}>
                            {t('label.add-field')}
                          </Button>
                          {stage !== OnboardingStage.Creation && (
                            <Button
                              color="secondary"
                              iconLeading={Plus}
                              isDisabled={controlsDisabled}
                              onPress={() => addStep(Type.Approval)}>
                              {t('label.add-approval')}
                            </Button>
                          )}
                        </>
                      )}
                    </Box>
                    <Box className="tw:w-full tw:lg:w-1/2" direction="col">
                      {selected ? (
                        <OnboardingCheckSettings
                          field={selectedField}
                          fields={catalog}
                          fixed={fixed}
                          stage={stage}
                          step={selected}
                          valueKind={onboardingValueKind(
                            selectedField,
                            properties
                          )}
                          workflows={workflows}
                          onChange={updateStep}
                          onFieldChange={updateField}
                          onMove={moveStep}
                        />
                      ) : (
                        <Typography className="tw:text-tertiary" size="text-sm">
                          {t('message.onboarding-select-check')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </SlideoutMenu.Content>
            <SlideoutMenu.Footer>
              <Box className="tw:justify-end tw:gap-3">
                <Button color="tertiary" onPress={close}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="intake-form-submit"
                  isDisabled={publishState.disabled}
                  isLoading={publishState.loading}
                  onPress={handleSave}>
                  {publishState.label}
                </Button>
              </Box>
            </SlideoutMenu.Footer>
          </>
        )}
      </SlideoutMenu>
    </>
  );
};

export default IntakeFormDesignerModal;
