/*
 *  Copyright 2025 Collate.
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
interface WorkflowStage {
  name: string;
  startedAt: number;
  endedAt: number;
  tasks: string[];
  variables: Record<string, any>;
}

export interface WorkflowHistoryItem {
  id: string;
  workflowInstanceId: string;
  workflowInstanceExecutionId: string;
  workflowDefinitionId: string;
  stage: WorkflowStage;
  timestamp: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PENDING' | 'CANCELLED';
  exception?: string;
}
