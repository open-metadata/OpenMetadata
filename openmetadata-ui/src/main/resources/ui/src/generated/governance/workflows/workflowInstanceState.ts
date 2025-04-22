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
/**
 * Defines a workflow instance.
 */
export interface WorkflowInstanceState {
    exception?: string;
    /**
     * Unique identifier of this workflow instance state.
     */
    id?:     string;
    stage?:  Stage;
    status?: WorkflowStatus;
    /**
     * Timestamp on which the workflow instance state was created.
     */
    timestamp?: number;
    /**
     * Workflow Definition Reference.
     */
    workflowDefinitionId?: string;
    /**
     * One WorkflowInstance might execute a flow multiple times. This ID groups together the
     * States of one of those flows.
     */
    workflowInstanceExecutionId?: string;
    /**
     * Workflow Instance ID.
     */
    workflowInstanceId?: string;
}

export interface Stage {
    /**
     * Timestamp on which the workflow instance stage ended.
     */
    endedAt?: number;
    name?:    string;
    /**
     * Timestamp on which the workflow instance stage started.
     */
    startedAt?: number;
    tasks?:     string[];
    variables?: { [key: string]: any };
}

export enum WorkflowStatus {
    Exception = "EXCEPTION",
    Failure = "FAILURE",
    Finished = "FINISHED",
    Running = "RUNNING",
}
