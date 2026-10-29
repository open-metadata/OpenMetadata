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

import { ReactNode } from 'react';
import {
  OntologyEdge,
  OntologyNode,
  OntologyProposalPermissions,
  OntologyProposalRef,
} from '../components/OntologyExplorer/OntologyExplorer.interface';
import { OntologyHealthAiProposals } from '../components/OntologyExplorer/OntologyHealthPanel';
import { Glossary } from '../generated/entity/data/glossary';
import { RelationshipType } from '../generated/entity/data/relationshipType';

export interface OntologyAiProposalsOptions {
  /** True while the Studio canvas shows the concept model. */
  readonly isEnabled: boolean;
  /** Glossaries picked in the Studio; empty means all of them. */
  readonly selectedGlossaryIds?: string[];
  readonly glossaries: Glossary[];
  readonly graphNodes?: OntologyNode[];
  readonly permissions: OntologyProposalPermissions;
  readonly relationTypes: RelationshipType[];
  /** A proposal changed the ontology; reload the graph. */
  readonly onApplied: () => void;
  /** Open the concept with this FQN for editing once the graph has it. */
  readonly onEditTerm: (fullyQualifiedName: string) => void;
  readonly onSelectTerm: (nodeId: string) => void;
}

export interface OntologyAiProposals {
  /** Proposed concepts and relationships drawn on the canvas. */
  readonly nodes: OntologyNode[];
  readonly edges: OntologyEdge[];
  /** The proposed concept under review, drawn as selected. */
  readonly focusNodeId?: string;
  /** Proposals parked in the Ontology health panel. */
  readonly healthEntry?: OntologyHealthAiProposals;
  /** A canvas overlay is showing along the bottom edge. */
  readonly hasCanvasOverlay: boolean;
  readonly canvasOverlay: ReactNode;
  readonly drawer: ReactNode;
  readonly openProposal: (ref: OntologyProposalRef) => void;
}
