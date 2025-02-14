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
 * Governance Workflow Edge.
 */
export interface Edge {
    /**
     * Defines if the edge will follow a path depending on the source node result.
     */
    condition?: string;
    /**
     * Element from which the edge will start.
     */
    from: string;
    /**
     * Element on which the edge will end.
     */
    to: string;
}
