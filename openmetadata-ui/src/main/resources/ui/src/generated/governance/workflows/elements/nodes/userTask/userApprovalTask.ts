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
 * Defines a Task for a given User to approve.
 */
export interface UserApprovalTask {
    branches?: string[];
    config?:   NodeConfiguration;
    /**
     * Description of the Node.
     */
    description?: string;
    /**
     * Display Name that identifies this Node.
     */
    displayName?:       string;
    input?:             string[];
    inputNamespaceMap?: InputNamespaceMap;
    /**
     * Name that identifies this Node.
     */
    name?:    string;
    output?:  string[];
    subType?: string;
    type?:    string;
    [property: string]: any;
}

export interface NodeConfiguration {
    /**
     * Number of reviewers that must approve for the task to be completed. Default is 1 (any
     * single reviewer can approve).
     */
    approvalThreshold?: number;
    /**
     * People/Teams assigned to the Task.
     */
    assignees: Assignees;
    /**
     * Number of reviewers that must reject for the task to be rejected. Default is 1 (any
     * single reviewer can reject). This allows for scenarios where you want multiple approvals
     * but a single rejection can veto.
     */
    rejectionThreshold?: number;
}

/**
 * People/Teams assigned to the Task.
 */
export interface Assignees {
    /**
     * Add the Reviewers to the assignees List.
     */
    addReviewers?: boolean;
    /**
     * Additional assignees with optional users and teams.
     */
    extraAssignees?: ExtraAssignees;
    /**
     * List of team names to assign the task to.
     */
    teams?: string[];
    /**
     * List of user names to assign the task to.
     */
    users?: string[];
}

/**
 * Additional assignees with optional users and teams.
 */
export interface ExtraAssignees {
    /**
     * List of additional team names to assign the task to.
     */
    teams?: string[];
    /**
     * List of additional user names to assign the task to.
     */
    users?: string[];
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
