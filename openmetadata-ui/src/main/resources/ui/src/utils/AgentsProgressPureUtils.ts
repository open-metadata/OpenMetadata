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

import { Agent } from '../components/ServiceAgents/AgentsPage.interface';
import {
  GlobalCounter,
  ProgressNode,
  ProgressUpdate,
  ProgressUpdateType,
} from '../generated/entity/services/ingestionPipelines/serviceProgressEvent';
import { getShortRelativeTime } from './date-time/DateTimeUtils';

export type AgentFields =
  | 'status'
  | 'pct'
  | 'assets'
  | 'target'
  | 'eta'
  | 'finishedAt'
  | 'failStep';

export const isTerminalProgressUpdate = (
  updateType: ProgressUpdateType
): boolean =>
  updateType === ProgressUpdateType.PipelineComplete ||
  updateType === ProgressUpdateType.Error;

export const sumGlobalCounters = (counters: GlobalCounter[]): number =>
  counters.reduce((sum, counter) => sum + (counter.done ?? 0), 0);

export const sumLeafProcessed = (node: ProgressNode): number =>
  node.children?.length
    ? node.children.reduce((sum, child) => sum + sumLeafProcessed(child), 0)
    : node.processed ?? 0;

const computeAssets = (agent: Agent, update: ProgressUpdate): number => {
  let candidate = agent.assets;
  if (update.globalCounters?.length) {
    candidate = sumGlobalCounters(update.globalCounters);
  } else if (update.progress) {
    candidate = sumLeafProcessed(update.progress);
  }

  return Math.max(candidate, agent.assets);
};

const computeTarget = (
  agent: Agent,
  update: ProgressUpdate,
  assets: number
): number => {
  const counters = update.globalCounters;
  let target = agent.target;
  if (
    counters?.length &&
    counters.every(
      (counter) => counter.total !== null && counter.total !== undefined
    )
  ) {
    target = counters.reduce((sum, counter) => sum + (counter.total ?? 0), 0);
  } else if (target === 0 && assets > 0) {
    target = Math.max(assets, 1);
  }

  return target;
};

const computeEta = (agent: Agent, update: ProgressUpdate): number | null =>
  update.estimatedSecondsRemaining ?? agent.eta;

const buildRunningFields = (
  agent: Agent,
  update: ProgressUpdate
): Pick<Agent, AgentFields> => {
  const assets = computeAssets(agent, update);
  const target = computeTarget(agent, update, assets);
  const rawPct =
    target > 0 ? Math.min(100, Math.round((assets / target) * 100)) : agent.pct;

  return {
    status: 'running',
    pct: Math.max(rawPct, agent.pct),
    assets,
    target,
    eta: computeEta(agent, update),
    finishedAt: undefined,
    failStep: undefined,
  };
};

const buildCompletedFields = (
  agent: Agent,
  update: ProgressUpdate
): Pick<Agent, AgentFields> => {
  const assets = computeAssets(agent, update);

  return {
    status: 'success',
    pct: 100,
    assets,
    target: Math.max(assets, 1),
    eta: 0,
    finishedAt: getShortRelativeTime(update.timestamp),
    failStep: undefined,
  };
};

const buildFailedFields = (
  agent: Agent,
  update: ProgressUpdate
): Pick<Agent, AgentFields> => {
  const assets = computeAssets(agent, update);
  const target = computeTarget(agent, update, assets);

  return {
    status: 'failed',
    pct: agent.pct,
    assets,
    target,
    eta: null,
    finishedAt: getShortRelativeTime(update.timestamp),
    failStep: update.stepName ?? agent.failStep,
  };
};

/**
 * Applies one SSE progress update to an agent view-model. Pure: never mutates
 * the input agent, no I/O. Errors/warnings are intentionally untouched — the
 * stream payload carries no such counts; they are reconciled from
 * pipelineStatuses once every run has finished.
 */
export const applyProgressToAgent = (
  agent: Agent,
  update: ProgressUpdate
): Agent => {
  let fields;
  if (update.updateType === ProgressUpdateType.PipelineComplete) {
    fields = buildCompletedFields(agent, update);
  } else if (update.updateType === ProgressUpdateType.Error) {
    fields = buildFailedFields(agent, update);
  } else {
    fields = buildRunningFields(agent, update);
  }

  return { ...agent, ...fields };
};

/**
 * Resets the live-progress fields of an agent when a new run starts, so the
 * previous run's counters never bleed into the new run's bar.
 */
export const resetAgentProgress = (agent: Agent): Agent => ({
  ...agent,
  pct: 0,
  assets: 0,
  target: 0,
  eta: null,
  finishedAt: undefined,
  failStep: undefined,
});
