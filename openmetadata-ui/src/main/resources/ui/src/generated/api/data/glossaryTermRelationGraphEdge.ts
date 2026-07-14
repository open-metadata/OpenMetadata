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
 * A directed, typed relation between two glossary terms.
 */
export interface GlossaryTermRelationGraphEdge {
    /**
     * Identifier of the source glossary term.
     */
    from: string;
    /**
     * Configured type of the glossary relation.
     */
    relationType: string;
    /**
     * Identifier of the target glossary term.
     */
    to: string;
}
