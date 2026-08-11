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
import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import { APPLICATION_JSON_CONTENT_TYPE_HEADER } from '../constants/constants';
import { CreateWorkflowDefinition } from '../generated/api/governance/createWorkflowDefinition';
import { WorkflowDefinition } from '../generated/governance/workflows/workflowDefinition';
import { WorkflowInstance } from '../generated/governance/workflows/workflowInstance';
import APIClient from './index';

const WORKFLOW_DEFINITIONS_BASE_URL = '/governance/workflowDefinitions';
const WORKFLOW_INSTANCES_BASE_URL = '/governance/workflowInstances';

export interface WorkflowDefinitionsParams {
  limit?: number;
  offset?: number;
  before?: string;
  after?: string;
}

export const getWorkflowDefinitions = async (
  params?: WorkflowDefinitionsParams
) => {
  const res = await APIClient.get<PagingResponse<WorkflowDefinition[]>>(
    WORKFLOW_DEFINITIONS_BASE_URL,
    {
      params: params,
    }
  );

  return res.data;
};

export const createWorkflowDefinition = async (
  data: CreateWorkflowDefinition
) => {
  const response = await APIClient.post<
    CreateWorkflowDefinition,
    AxiosResponse<WorkflowDefinition>
  >(WORKFLOW_DEFINITIONS_BASE_URL, data, APPLICATION_JSON_CONTENT_TYPE_HEADER);

  return response.data;
};

export const getWorkflowDefinitionByFQN = async (fqn: string) => {
  const res = await APIClient.get(
    `${WORKFLOW_DEFINITIONS_BASE_URL}/name/${fqn}`
  );

  return res.data;
};

export interface WorkflowInstancesParams {
  limit?: number;
  offset?: string;
}

export const getWorkflowInstancesByFQN = async (
  fqn: string,
  params?: WorkflowInstancesParams
) => {
  const res = await APIClient.get<PagingResponse<WorkflowInstance[]>>(
    `${WORKFLOW_INSTANCES_BASE_URL}`,
    {
      params: {
        workflowDefinitionName: fqn,
        startTs: 0,
        endTs: Date.now(),
        ...params,
      },
    }
  );

  return res.data;
};

export const getWorkflowInstanceDetails = async (
  fqn: string,
  instanceId: string
) => {
  const res = await APIClient.get(
    `governance/workflowInstanceStates/${fqn}/${instanceId}`
  );

  return res.data;
};

export const updateWorkflowDefinition = async (data: WorkflowDefinition) => {
  const response = await APIClient.put<
    WorkflowDefinition,
    AxiosResponse<WorkflowDefinition>
  >(
    `${WORKFLOW_DEFINITIONS_BASE_URL}`,
    data,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const patchWorkflowDefinition = async (
  id: string,
  data: Operation[]
) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<WorkflowDefinition>
  >(`${WORKFLOW_DEFINITIONS_BASE_URL}/${id}`, data);

  return response.data;
};

export const triggerWorkflow = async (workflowFqn: string) => {
  return APIClient.post(
    `${WORKFLOW_DEFINITIONS_BASE_URL}/name/${workflowFqn}/trigger`,
    {}
  );
};

export const validateWorkflowDefinition = async (
  workflowData: WorkflowDefinition
) => {
  const response = await APIClient.post<
    WorkflowDefinition,
    AxiosResponse<{
      message: string;
      status?: string;
      validatedAt?: number;
      code?: number;
    }>
  >(
    `${WORKFLOW_DEFINITIONS_BASE_URL}/validate`,
    workflowData,
    APPLICATION_JSON_CONTENT_TYPE_HEADER
  );

  return response.data;
};

export const deleteWorkflowByFQN = async (
  workflowFQN: string,
  hardDelete = true
) => {
  const response = await APIClient.delete<WorkflowDefinition>(
    `${WORKFLOW_DEFINITIONS_BASE_URL}/name/${workflowFQN}`,
    {
      params: {
        hardDelete,
      },
    }
  );

  return response.data;
};
