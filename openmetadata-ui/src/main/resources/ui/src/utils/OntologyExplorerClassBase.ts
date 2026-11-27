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
import { ComponentType } from 'react';
import { Task } from '../generated/entity/tasks/task';

export interface OntologyReviewPanelProps {
  readonly task: Task;
  /** Approve and Reject stay hidden until the panel has loaded the release. */
  readonly onReadyChange: (ready: boolean) => void;
}

class OntologyExplorerClassBase {
  /**
   * The release under review on an ontology review task. Ontology Studio, where
   * releases are authored, is Collate-only, so OSS shows the generic task view.
   * ADR:2026-11-15-ontology-studio-ui-ships-only-in-collate
   */
  public getReviewPanel(): ComponentType<OntologyReviewPanelProps> | null {
    return null;
  }
}

const ontologyExplorerClassBase = new OntologyExplorerClassBase();

export default ontologyExplorerClassBase;
export { OntologyExplorerClassBase };
