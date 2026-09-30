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
 * What saving a proposed edit would do, computed without saving anything.
 */
export interface ChangeRequestPreview {
    entityId:   string;
    entityType: string;
    /**
     * Operations the edit would submit, each with the published value it is based on.
     */
    ops?: MutationOp[];
    /**
     * True when the edit would be held for review instead of published.
     */
    requiresApproval: boolean;
    /**
     * Workflow that would review the edit.
     */
    workflowDefinitionId?: string;
}

/**
 * One normalized operation of a proposed metadata change, recorded with the published value
 * it was computed against.
 */
export interface MutationOp {
    /**
     * JSON of the published field value this op was computed against. Set ops only.
     */
    baseValue?: string;
    /**
     * Top-level entity field name.
     */
    field: string;
    /**
     * True when an approval workflow gates this field; false for a field carried along in a
     * staged request.
     */
    gated?: boolean;
    /**
     * Element identity for add/remove: entity reference id, tag FQN, or the string value itself.
     */
    key?: string;
    op:   MutationOpType;
    /**
     * JSON of the proposed field value (set) or of the element being added/removed.
     */
    value?: string;
}

/**
 * set replaces a top-level field value; add and remove change one element of a list field
 * identified by key.
 */
export enum MutationOpType {
    Add = "add",
    Remove = "remove",
    Set = "set",
}
