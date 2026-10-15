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
import { compact, keyBy, orderBy, uniq } from 'lodash';
import { WorkflowDefinition } from '../../../../../generated/governance/workflows/workflowDefinition';
import { WorkflowInstance } from '../../../../../generated/governance/workflows/workflowInstance';
import { WorkflowInstanceState } from '../../../../../generated/governance/workflows/workflowInstanceState';
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../../../../rest/workflowAPI';
import { WorkflowInstanceStateParams } from '../../../../../rest/workflowAPI.interface';
import { getWorkflowDefinitionById } from '../../../../../rest/workflowDefinitionsAPI';

export interface LatestWorkflowRun {
  definition: WorkflowDefinition;
  states: WorkflowInstanceState[];
}

const RECENT_INSTANCES_LIMIT = 25;
const STAGE_FIELDS = ['status', 'entityStatus'];

interface StageNode {
  subType?: string;
  config?: { fieldName?: string };
}

/**
 * The card follows the term's stage, so only a workflow that sets it counts: the default approval
 * workflow or a lifecycle playbook, not an event-based workflow that merely ran on the term.
 */
export const setsEntityStage = (definition: WorkflowDefinition): boolean =>
  Boolean(definition.config?.lifecycle) ||
  (definition.nodes ?? []).some(
    (node: StageNode) =>
      node.subType === 'setGlossaryTermStatusTask' ||
      (node.subType === 'setEntityAttributeTask' &&
        STAGE_FIELDS.includes(node.config?.fieldName ?? ''))
  );

const getInstanceStart = ({ startedAt, timestamp }: WorkflowInstance) =>
  startedAt ?? timestamp ?? 0;

// Definitions are resolved together and a run whose definition cannot be read (deleted, or hidden
// from the user by a conditional rule) is skipped, so an older readable run still shows.
const getReadableDefinitions = async (instances: WorkflowInstance[]) => {
  const ids = uniq(
    compact(instances.map(({ workflowDefinitionId }) => workflowDefinitionId))
  );
  const results = await Promise.allSettled(
    ids.map((id) => getWorkflowDefinitionById(id))
  );

  return keyBy(
    results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    ),
    'id'
  );
};

/**
 * Without a definition name the instance list covers every workflow that ran for the entity; the
 * newest run of a workflow that sets the entity's stage decides whose history the card shows.
 */
export const getLatestWorkflowRun = async (
  entityLink: string,
  timeRange: WorkflowInstanceStateParams
): Promise<LatestWorkflowRun | undefined> => {
  const { data } = await getWorkflowInstancesForApplication({
    ...timeRange,
    entityLink,
    limit: RECENT_INSTANCES_LIMIT,
  });
  const instances = orderBy(data ?? [], getInstanceStart, 'desc');
  const definitions = await getReadableDefinitions(instances);
  const instance = instances.find(
    ({ id, workflowDefinitionId }) =>
      id &&
      workflowDefinitionId &&
      definitions[workflowDefinitionId] &&
      setsEntityStage(definitions[workflowDefinitionId])
  );
  let latestRun: LatestWorkflowRun | undefined;

  if (instance?.id && instance.workflowDefinitionId) {
    const definition = definitions[instance.workflowDefinitionId];
    const { data: states } = await getWorkflowInstanceStateById(
      definition.name,
      instance.id,
      timeRange
    );
    latestRun = { definition, states: [...states].reverse() };
  }

  return latestRun;
};
