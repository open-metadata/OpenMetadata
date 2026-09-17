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
import { isAxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { EvaluateOnboarding } from '../../../generated/api/governance/evaluateOnboarding';
import { TransitionOnboarding } from '../../../generated/api/governance/transitionOnboarding';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Metric } from '../../../generated/entity/data/metric';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import { OnboardingBackfill } from '../../../generated/governance/onboarding/onboardingBackfill';
import { OnboardingBoard } from '../../../generated/governance/onboarding/onboardingBoard';
import { OnboardingProgress } from '../../../generated/governance/onboarding/onboardingProgress';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import APIClient from '../../index';

const BASE = '/governance/onboarding';

export const getOnboardingWorkflow = async (id: string) =>
  (
    await APIClient.get<WorkflowDefinition>(
      `/governance/workflowDefinitions/${id}`,
      { params: { fields: '*' } }
    )
  ).data;
const ENTITY_PATHS: Record<TargetEntityType, string> = {
  dataProduct: 'dataProducts',
  domain: 'domains',
  glossaryTerm: 'glossaryTerms',
  metric: 'metrics',
};

export type OnboardingAsset = DataProduct | Domain | GlossaryTerm | Metric;
export interface OnboardingBoardFilters {
  entityType?: TargetEntityType;
  stage?: string;
  domain?: string;
  assignee?: string;
  after?: string;
  limit?: number;
}
export const getOnboardingProgress = async (
  type: TargetEntityType,
  id: string
) => {
  try {
    return (await APIClient.get<OnboardingProgress>(`${BASE}/${type}/${id}`))
      .data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
};

export const evaluateOnboarding = async (
  request: EvaluateOnboarding,
  signal?: AbortSignal
) =>
  (
    await APIClient.post<OnboardingProgress>(`${BASE}/evaluate`, request, {
      signal,
    })
  ).data;
export const transitionOnboarding = async (
  type: TargetEntityType,
  id: string,
  request: TransitionOnboarding
) =>
  (
    await APIClient.post<OnboardingProgress>(
      `${BASE}/${type}/${id}/transition`,
      request
    )
  ).data;
export const listOnboarding = async (
  params: OnboardingBoardFilters,
  signal?: AbortSignal
) => (await APIClient.get<OnboardingBoard>(BASE, { params, signal })).data;
export const getOnboardingBackfill = async (type: TargetEntityType) =>
  (await APIClient.get<OnboardingBackfill | null>(`${BASE}/backfill/${type}`))
    .data;
export const retryOnboardingBackfill = async (type: TargetEntityType) =>
  (await APIClient.post<OnboardingBackfill>(`${BASE}/backfill/${type}/retry`))
    .data;
export const getOnboardingAsset = async (type: TargetEntityType, id: string) =>
  (
    await APIClient.get<OnboardingAsset>(`/${ENTITY_PATHS[type]}/${id}`, {
      params: { fields: '*' },
    })
  ).data;
export const patchOnboardingAsset = async (
  type: TargetEntityType,
  id: string,
  patch: Operation[]
) =>
  (
    await APIClient.patch<OnboardingAsset>(
      `/${ENTITY_PATHS[type]}/${id}`,
      patch
    )
  ).data;
