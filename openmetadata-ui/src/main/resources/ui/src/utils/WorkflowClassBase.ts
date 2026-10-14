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
import { WorkflowDefinition } from '../generated/governance/workflows/workflowDefinition';

export interface WorkflowCapabilities {
  allowCreateWorkflow: boolean;
  allowDeleteWorkflow: boolean;
  allowStructuralGraphEdits: boolean;
  showWorkflowNodePalette: boolean;
  allowFullStartNodeConfiguration: boolean;
  allowStartNodeFilterScheduleAndBatchEdit: boolean;
  allowScheduledTrigger: boolean;
  allowViewModeDrag: boolean;
}

/** Another editor that owns a workflow's shape, linked from the workflow builder. */
export interface WorkflowEditorLink {
  path: string;
  labelKey: string;
}

export interface WorkflowsPageTab {
  id: string;
  labelKey: string;
  /** Keeps only the workflows this tab lists; every workflow when absent. */
  includes?: (workflow: WorkflowDefinition) => boolean;
}

export class WorkflowClassBase {
  /** What the builder allows; `workflow` is the one open in it, when there is one. */
  public getCapabilities(_workflow?: WorkflowDefinition): WorkflowCapabilities {
    return {
      allowCreateWorkflow: false,
      allowDeleteWorkflow: false,
      allowStructuralGraphEdits: false,
      showWorkflowNodePalette: false,
      allowFullStartNodeConfiguration: false,
      allowStartNodeFilterScheduleAndBatchEdit: true,
      allowScheduledTrigger: false,
      allowViewModeDrag: true,
    };
  }

  /** Content shown above the workflow list; OpenMetadata has none. */
  public getWorkflowsPageSection(): ComponentType | null {
    return null;
  }

  /** Tabs that narrow the workflow list; OpenMetadata lists every workflow untabbed. */
  public getWorkflowsPageTabs(): WorkflowsPageTab[] {
    return [];
  }

  /** The editor that owns this workflow's shape, if the builder is not that editor. */
  public getWorkflowEditorLink(
    _workflow?: WorkflowDefinition | null
  ): WorkflowEditorLink | undefined {
    return undefined;
  }

  /** Where opening a workflow leads; undefined keeps the workflow details page. */
  public getWorkflowPath(_workflow: WorkflowDefinition): string | undefined {
    return undefined;
  }
}

const workflowClassBase = new WorkflowClassBase();

export default workflowClassBase;
