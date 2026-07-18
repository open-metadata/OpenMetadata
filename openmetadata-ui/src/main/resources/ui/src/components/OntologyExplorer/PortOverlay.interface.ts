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

import { RefObject } from 'react';

export const ONTOLOGY_EDIT_CANCEL_EVENT = 'ontology-edit-cancel';
export const ONTOLOGY_EDIT_NODE_CLICK_EVENT = 'ontology-edit-node-click';

export interface OntologyEditNodeClickDetail {
  clientX: number;
  clientY: number;
  isPort: boolean;
  nodeId: string;
}

export interface PortOverlayProps {
  /** The G6 graph container; canvas edit events are dispatched from this element. */
  containerRef: RefObject<HTMLDivElement>;
  isEditMode: boolean;
  nodeLabels: Record<string, string>;
  /** Persist a new typed relation between two glossary terms (ids are term UUIDs = graph node ids). */
  onCreateRelation: (
    fromId: string,
    toId: string,
    relationType: string
  ) => Promise<void>;
}
