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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Type,
  WorkflowDefinition,
} from '../generated/governance/workflows/workflowDefinition';
import workflowClassBase from '../utils/WorkflowClassBase';

export type WorkflowMode = 'view' | 'edit';

const shouldShowRunButton = (
  workflowDefinition?: WorkflowDefinition
): boolean => {
  if (!workflowDefinition) {
    return false;
  }

  const trigger = workflowDefinition.trigger;
  const isTriggerObject =
    typeof trigger === 'object' && trigger !== null && !Array.isArray(trigger);

  if (!isTriggerObject) {
    return false;
  }

  const triggerType = trigger.type;
  const isPeriodicBatchEntity = triggerType === Type.PeriodicBatchEntity;

  const scheduleTimeline = trigger.config?.schedule?.scheduleTimeline;
  const cronExpression = trigger.config?.schedule?.cronExpression;

  const isOnDemand =
    scheduleTimeline === 'None' &&
    (cronExpression === '' || cronExpression === undefined);

  return isPeriodicBatchEntity && isOnDemand;
};

export interface UseWorkflowModeReturn {
  mode: WorkflowMode;
  isViewMode: boolean;
  isEditMode: boolean;
  enterEditMode: () => void;
  enterViewMode: () => void;
  toggleMode: () => void;
  canEdit: boolean;
  canSave: boolean;
  canDelete: boolean;
  canDragNodes: boolean;
  canAccessSidebar: boolean;
  showEditButton: boolean;
  showSaveButton: boolean;
  showCancelButton: boolean;
  showTestButton: boolean;
  showDeleteButton: boolean;
  showRunButton: boolean;
  isFormDisabled: boolean;
  isInputDisabled: boolean;
  isDropdownDisabled: boolean;
  allowStructuralGraphEdits: boolean;
  showWorkflowNodePalette: boolean;
  allowFullStartNodeConfiguration: boolean;
  allowStartNodeFilterScheduleAndBatchEdit: boolean;
  allowScheduledTrigger: boolean;
}

export const useWorkflowMode = (
  workflowFqn?: string,
  workflowDefinition?: WorkflowDefinition
): UseWorkflowModeReturn => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [internalMode, setInternalMode] = useState<WorkflowMode>('view');

  const initialMode = useMemo((): WorkflowMode => {
    const urlMode = searchParams.get('mode') as WorkflowMode;

    if (urlMode === 'edit' || urlMode === 'view') {
      return urlMode;
    }

    if (!workflowFqn) {
      return 'edit';
    }

    return 'view';
  }, [searchParams, workflowFqn]);

  useEffect(() => {
    setInternalMode(initialMode);
  }, [initialMode]);

  const enterEditMode = useCallback(() => {
    setInternalMode('edit');
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('mode', 'edit');

      return newParams;
    });
  }, [setSearchParams]);

  const enterViewMode = useCallback(() => {
    setInternalMode('view');

    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('mode', 'view');

      return newParams;
    });
  }, [setSearchParams]);

  const toggleMode = useCallback(() => {
    if (internalMode === 'view') {
      enterEditMode();
    } else {
      enterViewMode();
    }
  }, [internalMode, enterEditMode, enterViewMode]);

  const derivedStates = useMemo(() => {
    const isViewMode = internalMode === 'view';
    const isEditMode = internalMode === 'edit';
    const trigger = workflowDefinition?.trigger;
    const isTriggerObject =
      typeof trigger === 'object' &&
      trigger !== null &&
      !Array.isArray(trigger);
    const triggerType = isTriggerObject ? trigger.type : undefined;
    const isNoOpTrigger = triggerType === Type.NoOp;
    const caps = workflowClassBase.getCapabilities();
    const structural = caps.allowStructuralGraphEdits;
    const showWorkflowNodePalette = caps.showWorkflowNodePalette;
    const allowFullStartNodeConfiguration =
      caps.allowFullStartNodeConfiguration;
    const allowStartNodeFilterScheduleAndBatchEdit =
      caps.allowStartNodeFilterScheduleAndBatchEdit;
    const allowScheduledTrigger = caps.allowScheduledTrigger;

    return {
      mode: internalMode,
      isViewMode,
      isEditMode,

      canEdit: isEditMode && !isNoOpTrigger,
      canSave: isEditMode && !isNoOpTrigger,
      canDelete: isViewMode && !isNoOpTrigger && caps.allowDeleteWorkflow,
      canDragNodes: isEditMode && structural,
      canAccessSidebar: isEditMode,
      allowStructuralGraphEdits: structural,
      showWorkflowNodePalette,
      allowFullStartNodeConfiguration,
      allowStartNodeFilterScheduleAndBatchEdit,
      allowScheduledTrigger,

      showEditButton: isViewMode && !isNoOpTrigger,
      showSaveButton: isEditMode && !isNoOpTrigger,
      showCancelButton: isEditMode && !isNoOpTrigger,
      showTestButton: isEditMode && !isNoOpTrigger,
      showDeleteButton:
        isViewMode && !isNoOpTrigger && caps.allowDeleteWorkflow,
      showRunButton:
        isViewMode && !!workflowFqn && shouldShowRunButton(workflowDefinition),

      isFormDisabled: isViewMode,
      isInputDisabled: isViewMode,
      isDropdownDisabled: isViewMode,
    };
  }, [internalMode, workflowFqn, workflowDefinition]);

  return {
    ...derivedStates,
    enterEditMode,
    enterViewMode,
    toggleMode,
  };
};
