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
 * A glossary term represented as a node in the relation graph.
 */
export interface GlossaryTermRelationGraphNode {
    /**
     * Optional display name of the glossary term.
     */
    displayName?: string;
    /**
     * Fully qualified name of the glossary term.
     */
    fullyQualifiedName: string;
    /**
     * Identifier of the glossary term.
     */
    id: string;
    /**
     * Name of the glossary term.
     */
    name: string;
}
