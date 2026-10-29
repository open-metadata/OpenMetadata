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
 * An immutable, bounded snapshot in a sealed ontology release.
 */
export interface OntologyReleaseMember {
    memberId:   string;
    memberKind: MemberKind;
    /**
     * Captured content; readers never resolve this through a mutable definition or entity
     * history.
     */
    payload:        { [key: string]: any };
    payloadBytes:   number;
    payloadDigest:  string;
    releaseId:      string;
    sourceVersion?: number;
}

export enum MemberKind {
    Association = "ASSOCIATION",
    Axiom = "AXIOM",
    Concept = "CONCEPT",
    Ontology = "ONTOLOGY",
    Property = "PROPERTY",
    Shape = "SHAPE",
}
