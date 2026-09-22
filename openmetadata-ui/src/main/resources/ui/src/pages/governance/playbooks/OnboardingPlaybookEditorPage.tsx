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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import Loader from '../../../components/common/Loader/Loader';
import { PlaybookEditorHeader } from '../../../components/governance/playbooks/PlaybookEditorHeader';
import { PlaybookGateWorkspace } from '../../../components/governance/playbooks/PlaybookGateWorkspace';
import { PlaybookLifecycleRail } from '../../../components/governance/playbooks/PlaybookLifecycleRail';
import { PlaybookPreviewModal } from '../../../components/governance/playbooks/PlaybookPreviewModal';
import { PlaybookStageDialog } from '../../../components/governance/playbooks/PlaybookStageDialog';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import {
  EntityStatus,
  OnboardingConfiguration,
  OnboardingGate,
  OnboardingPlaybook,
  OnboardingStageDefinition,
  OnboardingStep,
  TargetEntityType as PlaybookEntityType,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import {
  getHandoffWorkflows,
  getOnboardingFields,
  getOnboardingPlaybookById,
  upsertOnboardingPlaybook,
} from '../../../rest/governance/onboarding/OnboardingPlaybook.api';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import {
  addStage,
  approvalCandidates,
  buildFieldOptions,
  buildStageSummaries,
  canRemoveStage,
  getCapturedFieldPaths,
  getGateForStage,
  getNextStage,
  getStages,
  moveStepInGate,
  removeStage,
  renameStage,
  scaffoldPlaybook,
  uniqueStepId,
} from '../../../utils/governance/playbooks/Playbook.utils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { PLAYBOOK_ENTITY_LABEL_KEY } from './OnboardingPlaybooks.constants';

/**
 * Edit what it takes to pass each gate of one asset type's playbook.
 *
 * <p>The Creation gate is enforced at the API and UI layers. Every later gate hands off to a
 * governance workflow, which owns the approval and the status change - this page decides when that
 * workflow is allowed to start, not what it decides.
 */
const OnboardingPlaybookEditorPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { playbookId, entityType } = useParams<{
    playbookId: string;
    entityType: string;
  }>();

  /** No id in the route means this asset type has no playbook yet - everything shown is a scaffold. */
  const isNew = !playbookId;

  const [playbook, setPlaybook] = useState<OnboardingPlaybook>();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>();
  const [selectedStepId, setSelectedStepId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [nativeFields, setNativeFields] = useState<string[]>([]);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );
  /** Set while the stage dialog is open: the stage being renamed, or `null` while adding one. */
  const [stageEdit, setStageEdit] =
    useState<OnboardingStageDefinition | null>();

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      // Independent reads - the workflow list does not depend on the playbook.
      const [loadedPlaybook, workflowList] = await Promise.all([
        playbookId
          ? getOnboardingPlaybookById(playbookId)
          : Promise.resolve(scaffoldPlaybook(entityType as PlaybookEntityType)),
        getHandoffWorkflows(),
      ]);
      setPlaybook(loadedPlaybook);
      setWorkflows(workflowList.data ?? []);
      setSelectedStage(getStages(loadedPlaybook.onboarding)[0]?.key);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [playbookId, entityType]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const playbookEntityType = playbook?.entityType;

  /**
   * What a check can ask for on this asset type. Read from the server rather than listed here so
   * the picker cannot offer a field the playbook validator rejects on publish.
   */
  useEffect(() => {
    if (!playbookEntityType) {
      return;
    }
    let isCurrent = true;
    // Two views of the same asset type; neither depends on the other.
    Promise.all([
      getOnboardingFields(playbookEntityType),
      getCustomPropertiesByEntityType(playbookEntityType),
    ])
      .then(([fields, properties]) => {
        if (isCurrent) {
          setNativeFields(fields);
          setCustomProperties(properties);
        }
      })
      .catch((error) => showErrorToast(error as AxiosError));

    return () => {
      isCurrent = false;
    };
  }, [playbookEntityType]);

  const fieldOptions = useMemo(
    () => buildFieldOptions(nativeFields, customProperties),
    [nativeFields, customProperties]
  );

  /** A step's workflow records a decision; it must not move the asset, which is the gate's job. */
  const stepWorkflows = useMemo(
    () => approvalCandidates(workflows),
    [workflows]
  );

  const configuration = playbook?.onboarding;

  const stageSummaries = useMemo(
    () =>
      buildStageSummaries(
        configuration,
        (stage) => stage.displayName ?? stage.key
      ),
    [configuration]
  );

  const activeStage = selectedStage ?? stageSummaries[0]?.key;
  const activeStageDefinition = useMemo(
    () => getStages(configuration).find((stage) => stage.key === activeStage),
    [configuration, activeStage]
  );
  const activeGate = useMemo(
    () =>
      activeStage ? getGateForStage(configuration, activeStage) : undefined,
    [configuration, activeStage]
  );
  /** The stage this gate leads to, as the gate panel names it in its sentences. */
  const nextStageLabel = useMemo(() => {
    const next = activeStage
      ? getNextStage(configuration, activeStage)
      : undefined;

    return next?.displayName ?? next?.key ?? '';
  }, [configuration, activeStage]);

  const updateConfiguration = useCallback((next: OnboardingConfiguration) => {
    setPlaybook((current) =>
      current ? { ...current, onboarding: next } : current
    );
  }, []);

  const handleGateChange = useCallback(
    (gate: OnboardingGate) => {
      if (!configuration) {
        return;
      }
      const gates = configuration.gates ?? [];
      const exists = gates.some((candidate) => candidate.stage === gate.stage);
      updateConfiguration({
        ...configuration,
        gates: exists
          ? gates.map((candidate) =>
              candidate.stage === gate.stage ? gate : candidate
            )
          : [...gates, gate],
      });
    },
    [configuration, updateConfiguration]
  );

  const capturedFieldPaths = useMemo(
    () => getCapturedFieldPaths(configuration),
    [configuration]
  );

  const handleAddCheck = useCallback(
    (step: OnboardingStep) => {
      // Two approvals at different gates would otherwise share an id, and a colliding id silently
      // overwrites the earlier check's progress.
      const added = { ...step, id: uniqueStepId(configuration, step.id) };
      handleGateChange({
        ...(activeGate ?? { stage: activeStage as string, steps: [] }),
        steps: [...(activeGate?.steps ?? []), added],
      });
      setSelectedStepId(added.id);
    },
    [activeGate, activeStage, configuration, handleGateChange]
  );

  const handleSaveStage = useCallback(
    (displayName: string, entityStatus?: EntityStatus) => {
      if (!configuration) {
        return;
      }
      if (stageEdit) {
        updateConfiguration(
          renameStage(configuration, stageEdit.key, displayName, entityStatus)
        );
      } else {
        // Keys identify a stage in saved progress, so a new one gets a key nothing can collide with
        // while its display name stays the author's.
        const key = `stage${Date.now()}`;
        updateConfiguration(
          addStage(configuration, { key, displayName, entityStatus })
        );
        setSelectedStage(key);
        setSelectedStepId(undefined);
      }
      setStageEdit(undefined);
    },
    [configuration, stageEdit, updateConfiguration]
  );

  const handleRemoveStage = useCallback(
    (key: string) => {
      if (!configuration) {
        return;
      }
      updateConfiguration(removeStage(configuration, key));
      setSelectedStage(getStages(configuration)[0]?.key);
      setSelectedStepId(undefined);
    },
    [configuration, updateConfiguration]
  );

  const entityLabel = playbook?.entityType
    ? t(PLAYBOOK_ENTITY_LABEL_KEY[playbook.entityType])
    : '';

  const playbookTitle = useMemo(
    () => (playbook ? t('label.entity-playbook', { entity: entityLabel }) : ''),
    [playbook, entityLabel, t]
  );

  const maintainer = useMemo(
    () =>
      playbook?.owners
        ?.map((owner) => owner.displayName ?? owner.name)
        .join(', ') || undefined,
    [playbook]
  );

  /**
   * `v4 · maintained by X · applies to every data product in the platform`. An unsaved playbook has
   * no version to show, so it says so rather than claiming a v1 that does not exist yet.
   */
  const subtitle = useMemo(
    () =>
      [
        isNew ? t('message.not-published-yet') : `v${playbook?.version ?? 1}`,
        maintainer
          ? t('message.maintained-by-owner', { owner: maintainer })
          : null,
        t('message.applies-to-every-entity', {
          entity: entityLabel.toLowerCase(),
        }),
      ]
        .filter(Boolean)
        .join(' · '),
    [isNew, playbook, maintainer, entityLabel, t]
  );

  const handleStepChange = useCallback(
    (updated: OnboardingStep) => {
      if (!activeGate) {
        return;
      }
      handleGateChange({
        ...activeGate,
        steps: (activeGate.steps ?? []).map((step) =>
          step.id === updated.id ? updated : step
        ),
      });
    },
    [activeGate, handleGateChange]
  );

  const handleStepRemove = useCallback(
    (stepId: string) => {
      if (!activeGate) {
        return;
      }
      handleGateChange({
        ...activeGate,
        steps: (activeGate.steps ?? []).filter((step) => step.id !== stepId),
      });
      setSelectedStepId(undefined);
    },
    [activeGate, handleGateChange]
  );

  const handleMoveStep = useCallback(
    (stepId: string, direction: -1 | 1) => {
      if (!configuration || !activeStage) {
        return;
      }
      updateConfiguration(
        moveStepInGate(configuration, activeStage, stepId, direction)
      );
    },
    [configuration, activeStage, updateConfiguration]
  );

  const handlePublish = useCallback(async () => {
    if (!playbook) {
      return;
    }
    try {
      setIsSaving(true);
      await upsertOnboardingPlaybook({
        name: playbook.name,
        displayName: playbook.displayName,
        description: playbook.description,
        entityType: playbook.entityType,
        onboarding: playbook.onboarding,
        intakeForm: playbook.intakeForm,
        owners: playbook.owners,
      });
      showSuccessToast(t('message.playbook-published'));
      await fetchAll();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  }, [playbook, fetchAll, t]);

  if (isLoading) {
    return <Loader />;
  }

  if (!playbook || !activeStage || !activeStageDefinition) {
    return null;
  }

  return (
    <PageLayoutV1 pageTitle={playbookTitle}>
      <div className="tw:flex tw:flex-col tw:gap-5 tw:p-6">
        <PlaybookEditorHeader
          isEnabled={Boolean(playbook.onboarding?.enabled)}
          isNew={isNew}
          isSaving={isSaving}
          subtitle={subtitle}
          title={playbookTitle}
          onBack={() => navigate('/settings/governance/onboarding-playbooks')}
          onPreview={() => setIsPreviewOpen(true)}
          onPublish={handlePublish}
        />

        <div
          className="tw:flex tw:items-start tw:gap-3 tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary tw:p-4"
          data-testid="creation-gate-callout">
          <Typography className="tw:flex-1 tw:text-sm tw:text-secondary">
            {t('message.creation-gate-is-the-intake-form')}
          </Typography>
          <Button
            color="link-color"
            size="sm"
            onPress={() => {
              const creation = stageSummaries.find((stage) => stage.isEntry);
              if (creation) {
                setSelectedStage(creation.key);
                setSelectedStepId(undefined);
              }
            }}>
            {t('label.open-creation-gate')}
          </Button>
        </div>

        <PlaybookLifecycleRail
          canRemoveStage={(stage) => canRemoveStage(configuration, stage)}
          selectedStage={activeStage}
          stages={stageSummaries}
          onAddStage={() => setStageEdit(null)}
          onRemoveStage={handleRemoveStage}
          onRenameStage={(stage) =>
            setStageEdit(
              getStages(configuration).find(
                (candidate) => candidate.key === stage
              ) ?? null
            )
          }
          onSelectStage={(stage) => {
            setSelectedStage(stage);
            setSelectedStepId(undefined);
          }}
        />

        <PlaybookGateWorkspace
          approvalWorkflows={stepWorkflows}
          capturedFieldPaths={capturedFieldPaths}
          customProperties={customProperties}
          entityLabel={entityLabel}
          gate={activeGate}
          maintainer={maintainer}
          nextStageLabel={nextStageLabel}
          options={fieldOptions}
          selectedStepId={selectedStepId}
          stage={activeStageDefinition}
          workflows={workflows}
          onAddCheck={handleAddCheck}
          onGateChange={handleGateChange}
          onMoveStep={handleMoveStep}
          onNewCustomProperty={() =>
            navigate(`/settings/${playbook.entityType}/customProperties`)
          }
          onOpenWorkflow={(workflowId) =>
            navigate(`/settings/governance/workflow-definitions/${workflowId}`)
          }
          onSelectStep={setSelectedStepId}
          onStepChange={handleStepChange}
          onStepRemove={handleStepRemove}
        />

        {isPreviewOpen && (
          <PlaybookPreviewModal
            playbook={playbook}
            properties={customProperties}
            stage={activeStage}
            workflows={workflows}
            onClose={() => setIsPreviewOpen(false)}
            onStageChange={setSelectedStage}
          />
        )}

        {stageEdit !== undefined && (
          <PlaybookStageDialog
            stage={stageEdit ?? undefined}
            onClose={() => setStageEdit(undefined)}
            onSave={handleSaveStage}
          />
        )}
      </div>
    </PageLayoutV1>
  );
};

export default OnboardingPlaybookEditorPage;
