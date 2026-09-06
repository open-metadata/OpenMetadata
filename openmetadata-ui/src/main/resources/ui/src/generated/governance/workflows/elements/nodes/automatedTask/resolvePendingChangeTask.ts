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
 * Resolves the approval-gated change held for the related entity. The action is configured
 * on the node itself (not inferred from the status): 'commit' persists the held change to
 * the entity (the point a real ChangeEvent is emitted); 'discard' drops it, leaving the
 * approved values in place; 'hold' leaves it held. Place this node after the status is set
 * (e.g. commit after Approved, discard after Rejected/Draft, hold after In Review).
 */
export interface ResolvePendingChangeTask {
    config: NodeConfiguration;
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
    name:                string;
    output?:             string[];
    outputNamespaceMap?: { [key: string]: string };
    subType?:            string;
    type?:               string;
}

export interface NodeConfiguration {
    action: Action;
}

/**
 * What to do with the held pending change.
 */
export enum Action {
    Commit = "commit",
    Discard = "discard",
    Hold = "hold",
}

export interface InputNamespaceMap {
    relatedEntity: string;
    updatedBy?:    string;
}
