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
/**
 * This schema defines the type for reporting the count of tasks by status.
 */
export interface TaskCount {
    /**
     * Total count of all tasks currently in the Approved status (across all task types). For
     * Data Access Requests this is the 'awaiting grant' bucket; for workflows where Approved is
     * terminal (e.g. Glossary, DescriptionUpdate) it reflects resolved tasks.
     */
    approved?: number;
    /**
     * Total count of all completed/closed tasks.
     */
    completed?: number;
    /**
     * Total count of all tasks currently in the Granted status. Today this status is only
     * emitted by the Data Access Request workflow to indicate access has been provisioned and
     * is active.
     */
    granted?: number;
    /**
     * Total count of all in-progress tasks.
     */
    inProgress?: number;
    /**
     * Total count of all open tasks.
     */
    open?: number;
    /**
     * Total count of all tasks.
     */
    total?: number;
}
