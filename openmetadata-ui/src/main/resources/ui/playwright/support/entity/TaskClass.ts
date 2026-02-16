/*
 *  Copyright 2024 Collate.
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
import { APIRequestContext, Page } from '@playwright/test';
import { uuid } from '../../utils/common';
import { EntityTypeEndpoint } from './Entity.interface';

export interface CreateTaskData {
  name?: string;
  description?: string;
  category: string;
  type: string;
  priority?: string;
  assignees?: string[];
  about?: string;
  aboutType?: string;
  domain?: string;
}

export interface TaskResponseData {
  id: string;
  name: string;
  taskId: string;
  displayName?: string;
  description?: string;
  fullyQualifiedName: string;
  category: string;
  type: string;
  status: string;
  priority?: string;
  createdBy?: { id: string; name: string };
  assignees?: { id: string; name: string }[];
}

export class TaskClass {
  endpoint = EntityTypeEndpoint.Task;
  responseData: TaskResponseData | null = null;
  data: CreateTaskData;

  constructor(data?: Partial<CreateTaskData>) {
    const uniqueName = `pw-task-${uuid()}`;
    this.data = {
      name: data?.name ?? uniqueName,
      description: data?.description ?? 'Playwright test task description',
      category: data?.category ?? 'MetadataUpdate',
      type: data?.type ?? 'DescriptionUpdate',
      priority: data?.priority ?? 'Medium',
      assignees: data?.assignees,
      about: data?.about,
      aboutType: data?.aboutType,
      domain: data?.domain,
    };
  }

  get() {
    return this.data;
  }

  set(data: TaskResponseData) {
    this.responseData = data;
  }

  async create(apiContext: APIRequestContext): Promise<TaskResponseData> {
    const response = await apiContext.post('/api/v1/tasks', {
      data: this.data,
    });
    const responseData = await response.json();
    this.responseData = responseData;

    return responseData;
  }

  async delete(apiContext: APIRequestContext): Promise<void> {
    if (!this.responseData?.id) {
      return;
    }
    await apiContext.delete(`/api/v1/tasks/${this.responseData.id}`, {
      params: { hardDelete: 'true' },
    });
  }

  async resolve(
    apiContext: APIRequestContext,
    resolutionType: string,
    comment?: string
  ): Promise<TaskResponseData> {
    if (!this.responseData?.id) {
      throw new Error('Task not created');
    }
    const response = await apiContext.post(
      `/api/v1/tasks/${this.responseData.id}/resolve`,
      {
        data: {
          resolutionType,
          comment,
        },
      }
    );
    const responseData = await response.json();
    this.responseData = responseData;

    return responseData;
  }

  async get(apiContext: APIRequestContext): Promise<TaskResponseData> {
    if (!this.responseData?.id) {
      throw new Error('Task not created');
    }
    const response = await apiContext.get(
      `/api/v1/tasks/${this.responseData.id}`
    );
    const responseData = await response.json();
    this.responseData = responseData;

    return responseData;
  }

  async visitEntityPage(page: Page): Promise<void> {
    if (!this.responseData?.taskId) {
      throw new Error('Task not created');
    }
    await page.goto(`/tasks/${this.responseData.taskId}`);
    await page.waitForLoadState('networkidle');
  }
}
