/*
 *  Copyright 2023 Collate.
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
import { CreateWorkflow } from 'generated/api/automations/createWorkflow';
import { Workflow } from 'generated/entity/automations/workflow';
import { TestConnectionDefinition } from 'generated/entity/services/connections/testConnectionDefinition';
import APIClient from './index';

export const getTestConnectionDefinitionByName = async (
  testDefinitionName: string
) => {
  const response = await APIClient.get<TestConnectionDefinition>(
    `services/testConnectionDefinitions/name/${testDefinitionName}`
  );

  return response.data;
};

export const addWorkflow = async (data: CreateWorkflow) => {
  const response = await APIClient.post<
    CreateWorkflow,
    AxiosResponse<Workflow>
  >(`automations/workflows`, data);

  return response.data;
};

export const updateWorkflow = async (data: CreateWorkflow) => {
  const response = await APIClient.put<CreateWorkflow, AxiosResponse<Workflow>>(
    `automations/workflows`,
    data
  );

  return response.data;
};

/**
 *
 * @param workflowId workflow to run
 * @returns status code like 200, 400, etc.
 */
export const triggerWorkflowById = async (workflowId: string) => {
  const response = await APIClient.post(
    `automations/workflows/trigger/${workflowId}`
  );

  return response.status;
};

export const getWorkflowById = async (workflowId: string) => {
  const response = await APIClient.get<Workflow>(
    `automations/workflows/${workflowId}`
  );

  return response.data;
};

export const deleteWorkflowById = async (
  workflowId: string,
  hardDelete = false
) => {
  const response = await APIClient.delete<Workflow>(
    `/automations/workflows/${workflowId}`,
    { params: { hardDelete } }
  );

  return response.data;
};
