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
import { PagingResponse } from 'Models';
import { CreateOnboardingPlaybook } from '../../../generated/api/governance/createOnboardingPlaybook';
import { OnboardingPlaybook } from '../../../generated/entity/governance/onboardingPlaybook';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import APIClient from '../../index';

const BASE = '/governance/onboardingPlaybooks';
const FIELDS = 'owners,entityType,onboarding,intakeForm';

export const getOnboardingPlaybooks = async () =>
  (
    await APIClient.get<PagingResponse<OnboardingPlaybook[]>>(BASE, {
      params: { fields: FIELDS, limit: 100 },
    })
  ).data;

export const getOnboardingPlaybookById = async (id: string) =>
  (
    await APIClient.get<OnboardingPlaybook>(`${BASE}/${id}`, {
      params: { fields: FIELDS },
    })
  ).data;

/**
 * The playbook governing an asset type, or undefined when none is configured. A 404 is the
 * documented answer for "not configured yet", so it is not surfaced as an error.
 */
export const getOnboardingPlaybookForEntityType = async (
  entityType: string
): Promise<OnboardingPlaybook | undefined> => {
  try {
    return (
      await APIClient.get<OnboardingPlaybook>(
        `${BASE}/entityType/${entityType}`,
        { params: { fields: 'owners' } }
      )
    ).data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }

    throw error;
  }
};

/**
 * The native fields a playbook may require on this asset type, resolved server-side from the asset
 * type itself. Hard-coding the list here would offer fields the validator rejects on publish -
 * `glossaryTerms` exists on a glossary term but not on a data product.
 */
export const getOnboardingFields = async (entityType: string) =>
  (await APIClient.get<string[]>(`${BASE}/fields/${entityType}`)).data;

export const upsertOnboardingPlaybook = async (
  playbook: CreateOnboardingPlaybook
) => (await APIClient.put<OnboardingPlaybook>(BASE, playbook)).data;

export const deleteOnboardingPlaybook = async (id: string) =>
  (await APIClient.delete(`${BASE}/${id}`)).data;

/**
 * How many assets of each type exist, for the manager's Assets column. Counts come from search, so a
 * failure here degrades the column to a dash rather than failing the page.
 */
export const getAssetCounts = async (
  entityTypes: string[]
): Promise<Record<string, number>> => {
  const results = await Promise.allSettled(
    entityTypes.map((entityType) =>
      APIClient.get<{ hits: { total: { value: number } } }>('/search/query', {
        params: { q: '', index: entityType, from: 0, size: 0 },
      }).then(
        (response) => [entityType, response.data.hits.total.value] as const
      )
    )
  );

  return Object.fromEntries(
    results
      .filter(
        (result): result is PromiseFulfilledResult<readonly [string, number]> =>
          result.status === 'fulfilled'
      )
      .map((result) => result.value)
  );
};

/**
 * Workflows a gate can hand off to. The playbook only decides when one is allowed to start - the
 * workflow itself owns the approval and the status change it results in.
 */
export const getHandoffWorkflows = async () =>
  (
    await APIClient.get<PagingResponse<WorkflowDefinition[]>>(
      '/governance/workflowDefinitions',
      { params: { limit: 100 } }
    )
  ).data;
