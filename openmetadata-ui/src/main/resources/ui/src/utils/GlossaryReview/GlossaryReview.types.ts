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
import { MemoryDerivation } from '../../generated/entity/context/memoryDerivation';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../generated/entity/data/glossaryTerm';
import { Task } from '../../rest/tasksAPI';

/** Who proposed a term awaiting review: an AI agent or a person. */
export type ProposalSource = 'ai' | 'person';

/** A glossary term that waits for a person to approve or reject it. */
export interface GlossaryProposal {
  term: GlossaryTerm;
  source: ProposalSource;
  /** Why an AI agent proposed the term; absent when the caller may not see its memory. */
  derivation?: MemoryDerivation;
  /** The open approval request that decides a person's proposal. */
  approvalTask?: Task;
}

export type ProposalDecision = EntityStatus.Approved | EntityStatus.Rejected;
