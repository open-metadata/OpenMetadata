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
  OnboardingPlaybook,
  Requirement,
  TargetEntityType,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import {
  PLAYBOOK_ENTITY_COUNT_KEY,
  PLAYBOOK_ENTITY_LABEL_KEY,
  PLAYBOOK_ENTITY_TYPES,
} from './OnboardingPlaybooks.constants';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface PlaybookRow {
  entityType: TargetEntityType;
  title: string;
  statusLabel: string;
  versionLabel: string;
  enforcedAtCreation: string;
  structure: string;
  maintainedBy: string;
  assets: string;
  isConfigured: boolean;
  playbook?: OnboardingPlaybook;
}

const NOT_SET = '—';

/** The design labels counts with the asset's own noun: `128 products`, `412 terms`. */
const formatAssets = (
  entityType: TargetEntityType,
  count: number | undefined,
  t: Translate
) =>
  count === undefined
    ? NOT_SET
    : t(PLAYBOOK_ENTITY_COUNT_KEY[entityType], { count });

/**
 * The entry stage is whichever stage the playbook marks as such; `creation` is the fallback for a
 * playbook that has not declared its lifecycle.
 */
export const isCreationStage = (
  playbook: OnboardingPlaybook,
  stage?: string
) => {
  const declared = playbook.onboarding?.stages?.find(
    (candidate) => candidate.key === stage
  );

  return declared ? Boolean(declared.entryStage) : stage === 'creation';
};

/** Checks that hold the Creation gate - what the API refuses to create the asset without. */
export const countEnforcedAtCreation = (playbook: OnboardingPlaybook) => {
  const creationGate = playbook.onboarding?.gates?.find((gate) =>
    isCreationStage(playbook, gate.stage)
  );

  return (creationGate?.steps ?? []).filter(
    (step) => step.requirement === Requirement.Blocking
  ).length;
};

export const countChecks = (playbook: OnboardingPlaybook) =>
  (playbook.onboarding?.gates ?? []).reduce(
    (total, gate) => total + (gate.steps?.length ?? 0),
    0
  );

export const buildPlaybookRows = (
  playbooks: OnboardingPlaybook[],
  t: Translate,
  assetCounts: Record<string, number> = {}
): PlaybookRow[] => {
  const byEntityType = new Map(
    playbooks.map((playbook) => [playbook.entityType, playbook])
  );

  return PLAYBOOK_ENTITY_TYPES.map((entityType) => {
    const playbook = byEntityType.get(entityType);
    const title = t('label.entity-playbook', {
      entity: t(PLAYBOOK_ENTITY_LABEL_KEY[entityType]),
    });

    if (!playbook) {
      return {
        entityType,
        title,
        statusLabel: t('label.not-configured'),
        versionLabel: `${NOT_SET} · ${t('label.never-configured')}`,
        enforcedAtCreation: t('message.no-checks-enforced-yet'),
        structure: NOT_SET,
        maintainedBy: NOT_SET,
        assets: formatAssets(entityType, assetCounts[entityType], t),
        isConfigured: false,
      };
    }

    const gates = playbook.onboarding?.gates?.length ?? 0;
    const enforced = countEnforcedAtCreation(playbook);

    return {
      entityType,
      title,
      statusLabel: playbook.onboarding?.enabled
        ? t('label.active')
        : t('label.disabled'),
      versionLabel: [
        `v${playbook.version ?? 1}`,
        playbook.updatedAt
          ? t('message.edited-relative', {
              time: getRelativeTime(playbook.updatedAt),
            })
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
      enforcedAtCreation:
        enforced === 0
          ? t('message.no-checks-enforced-yet')
          : t('message.fields-enforced-at-creation', { count: enforced }),
      structure: t('message.gates-and-checks', {
        gates,
        checks: countChecks(playbook),
      }),
      maintainedBy:
        playbook.owners
          ?.map((owner) => owner.displayName ?? owner.name)
          .join(', ') || NOT_SET,
      assets: formatAssets(entityType, assetCounts[entityType], t),
      isConfigured: true,
      playbook,
    };
  });
};
