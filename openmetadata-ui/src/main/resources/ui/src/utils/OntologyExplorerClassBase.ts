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

import {
  OntologyEdge,
  OntologyNode,
} from '../components/OntologyExplorer/OntologyExplorer.interface';
import {
  OntologyAiProposals,
  OntologyAiProposalsOptions,
} from './OntologyExplorerClassBase.interface';

const NO_NODES: OntologyNode[] = [];
const NO_EDGES: OntologyEdge[] = [];
const NO_AI_PROPOSALS: OntologyAiProposals = {
  canvasOverlay: null,
  drawer: null,
  edges: NO_EDGES,
  hasCanvasOverlay: false,
  nodes: NO_NODES,
  openProposal: () => undefined,
};

const useNoAiProposals = (
  _options: OntologyAiProposalsOptions
): OntologyAiProposals => NO_AI_PROPOSALS;

class OntologyExplorerClassBase {
  /**
   * Reviewing AI-proposed concepts and relationships on the Studio canvas.
   * Ontology AI is a Collate feature, so OSS proposes nothing; Collate returns
   * its own hook. The hook must be the same function on every call.
   * ADR:2026-10-16-ontology-ai-proposal-review-is-a-collate-extension
   */
  public getAiProposalsHook(): (
    options: OntologyAiProposalsOptions
  ) => OntologyAiProposals {
    return useNoAiProposals;
  }
}

const ontologyExplorerClassBase = new OntologyExplorerClassBase();

export default ontologyExplorerClassBase;
export { OntologyExplorerClassBase };
