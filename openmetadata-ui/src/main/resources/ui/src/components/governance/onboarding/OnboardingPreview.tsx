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
import { Alert, Box, Button, Select } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../generated/entity/type';
import {
  IntakeForm,
  OnboardingStage,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import {
  State,
  Type,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { EntityReference } from '../../../generated/type/entityReference';
import { getOnboardingAsset } from '../../../rest/governance/onboarding/Onboarding.api';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  fieldValue,
  ONBOARDING_STAGES,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import {
  PreviewContext,
  previewProgress,
  previewReferences,
  withPreviewValue,
} from '../../../utils/governance/onboarding/OnboardingPreview.utils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { OnboardingJourney } from './OnboardingJourney';
import { OnboardingFieldSession } from './OnboardingJourney.types';

interface Props {
  form: IntakeForm;
  properties: CustomProperty[];
  workflows: WorkflowDefinition[];
  creator: EntityReference;
  stage: OnboardingStage;
  onStageChange: (stage: OnboardingStage) => void;
}
const PREVIEW_PERMISSIONS = { ...DEFAULT_ENTITY_PERMISSION, EditAll: true };

export const OnboardingPreview = ({
  form,
  properties,
  workflows,
  creator,
  stage,
  onStageChange,
}: Props) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [decisions, setDecisions] = useState<Record<string, State>>({});
  const [domainOwners, setDomainOwners] = useState<EntityReference[]>([]);
  const [viewerId, setViewerId] = useState(creator.id);
  const context: PreviewContext = {
    form,
    values,
    decisions,
    domainOwners,
    creator,
    stage,
    workflows,
  };
  const latest = useRef(context);
  latest.current = context;
  const progress = useMemo(
    () =>
      previewProgress({
        form,
        values,
        decisions,
        domainOwners,
        creator,
        stage,
        workflows,
      }),
    [form, values, decisions, domainOwners, creator, stage, workflows]
  );
  const people = useMemo(
    () =>
      [
        creator,
        ...progress.steps.flatMap((result) => result.assignees ?? []),
      ].filter(
        (person, index, people) =>
          people.findIndex((candidate) => candidate.id === person.id) === index
      ),
    [creator, progress.steps]
  );
  const selectedViewer =
    people.find((person) => person.id === viewerId) ?? creator;
  const viewer = useMemo(
    () =>
      selectedViewer.type === 'team'
        ? { id: selectedViewer.id, teams: [selectedViewer] }
        : { id: selectedViewer.id },
    [selectedViewer]
  );
  const loadField = useCallback(
    async (path: string): Promise<OnboardingFieldSession> => ({
      value: fieldValue(latest.current.values, path),
      properties,
      save: async (value) => {
        let owners = latest.current.domainOwners;
        if (path === 'domains') {
          const domains = await Promise.all(
            previewReferences(value).map((domain) =>
              getOnboardingAsset(TargetEntityType.Domain, domain.id)
            )
          );
          owners = domains.flatMap((domain) => domain.owners ?? []);
          setDomainOwners(owners);
        }
        const nextValues = withPreviewValue(latest.current.values, path, value);
        const nextDecisions = previewProgress(latest.current).completed
          ? latest.current.decisions
          : {};
        const nextContext = {
          ...latest.current,
          values: nextValues,
          decisions: nextDecisions,
          domainOwners: owners,
        };
        latest.current = nextContext;
        setValues(nextValues);
        setDecisions(nextDecisions);

        return previewProgress(nextContext).steps.find(
          (result) => result.step.fieldPath === path
        );
      },
    }),
    [properties]
  );
  const reset = () => {
    setValues({});
    setDecisions({});
    setDomainOwners([]);
    setViewerId(creator.id);
    onStageChange(OnboardingStage.Creation);
  };

  return (
    <Box data-testid="onboarding-producer-preview" direction="col" gap={4}>
      <Alert title={t('message.onboarding-preview-help')} variant="brand" />
      <Box align="end" gap={3} justify="between" wrap="wrap">
        <Select
          label={t('label.onboarding-preview-as')}
          selectedKey={selectedViewer.id}
          onSelectionChange={(key) => setViewerId(String(key))}>
          {people.map((person) => (
            <Select.Item
              id={person.id}
              key={person.id}
              label={getEntityName(person)}
            />
          ))}
        </Select>
        <Button color="secondary" onPress={reset}>
          {t('label.reset')}
        </Button>
      </Box>
      <OnboardingJourney
        advance={async () => {
          if (!progress.canAdvance) {
            return;
          }
          const next = ONBOARDING_STAGES[ONBOARDING_STAGES.indexOf(stage) + 1];
          if (next) {
            onStageChange(next);
          }
        }}
        key={`${stage}-${selectedViewer.id}`}
        loadField={loadField}
        permissions={PREVIEW_PERMISSIONS}
        progress={progress}
        refresh={async () => {
          try {
            const refreshed = await Promise.all(
              previewReferences(values.domains).map((domain) =>
                getOnboardingAsset(TargetEntityType.Domain, domain.id)
              )
            );
            setDomainOwners(refreshed.flatMap((domain) => domain.owners ?? []));
          } catch (error) {
            showErrorToast(error as AxiosError);
          }
        }}
        renderApprovalActions={(result) =>
          result.step.type === Type.Approval ? (
            <Box gap={2} wrap="wrap">
              <Button
                color="secondary"
                isDisabled={
                  !result.assignees?.length ||
                  result.state === State.Failed ||
                  result.state === State.NotApplicable
                }
                onPress={() =>
                  setDecisions((current) => ({
                    ...current,
                    [result.step.id]: State.Complete,
                  }))
                }>
                {t('label.onboarding-simulate-approval')}
              </Button>
              <Button
                color="secondary"
                isDisabled={
                  !result.assignees?.length ||
                  result.state === State.Failed ||
                  result.state === State.NotApplicable
                }
                onPress={() =>
                  setDecisions((current) => ({
                    ...current,
                    [result.step.id]: State.Rejected,
                  }))
                }>
                {t('label.onboarding-simulate-rejection')}
              </Button>
            </Box>
          ) : null
        }
        viewer={viewer}
      />
    </Box>
  );
};
