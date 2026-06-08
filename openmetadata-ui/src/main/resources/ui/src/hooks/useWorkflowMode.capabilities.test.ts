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

import { renderHook } from '@testing-library/react';
import {
  Type,
  WorkflowDefinition,
} from '../generated/governance/workflows/workflowDefinition';
import workflowClassBase from '../utils/WorkflowClassBase';
import { useWorkflowMode } from './useWorkflowMode';

jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));

jest.mock('../utils/WorkflowClassBase', () => ({
  __esModule: true,
  default: {
    getCapabilities: jest.fn(() => ({
      allowCreateWorkflow: false,
      allowDeleteWorkflow: true,
      allowStructuralGraphEdits: false,
      showWorkflowNodePalette: false,
      allowFullStartNodeConfiguration: false,
      allowStartNodeFilterScheduleAndBatchEdit: true,
      allowScheduledTrigger: false,
    })),
  },
}));

const mockGetCapabilities = workflowClassBase.getCapabilities as jest.Mock;

const makeWorkflow = (
  triggerType: Type | undefined
): WorkflowDefinition | undefined => {
  if (triggerType === undefined) {
    return undefined;
  }

  return {
    name: 'TestWorkflow',
    trigger: { type: triggerType, config: {}, output: [] },
    nodes: [],
    edges: [],
  } as unknown as WorkflowDefinition;
};

describe('useWorkflowMode — isNoOp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCapabilities.mockReturnValue({
      allowCreateWorkflow: false,
      allowDeleteWorkflow: true,
      allowStructuralGraphEdits: false,
      showWorkflowNodePalette: false,
      allowFullStartNodeConfiguration: false,
      allowStartNodeFilterScheduleAndBatchEdit: true,
      allowScheduledTrigger: false,
    });
  });

  it('returns isNoOp true when trigger type is noOp', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('TestWorkflow', makeWorkflow(Type.NoOp))
    );

    expect(result.current.isNoOp).toBe(true);
  });

  it('returns isNoOp false when trigger type is eventBasedEntity', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('TestWorkflow', makeWorkflow(Type.EventBasedEntity))
    );

    expect(result.current.isNoOp).toBe(false);
  });

  it('returns isNoOp false when trigger type is periodicBatchEntity', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('TestWorkflow', makeWorkflow(Type.PeriodicBatchEntity))
    );

    expect(result.current.isNoOp).toBe(false);
  });

  it('returns isNoOp false when workflowDefinition is undefined', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('TestWorkflow', undefined)
    );

    expect(result.current.isNoOp).toBe(false);
  });
});

describe('useWorkflowMode — edit controls suppressed for noOp workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCapabilities.mockReturnValue({
      allowCreateWorkflow: false,
      allowDeleteWorkflow: true,
      allowStructuralGraphEdits: false,
      showWorkflowNodePalette: false,
      allowFullStartNodeConfiguration: false,
      allowStartNodeFilterScheduleAndBatchEdit: true,
      allowScheduledTrigger: false,
    });
  });

  it('suppresses showEditButton, showSaveButton, showDeleteButton for noOp workflows', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('TestWorkflow', makeWorkflow(Type.NoOp))
    );

    expect(result.current.showEditButton).toBe(false);
    expect(result.current.showSaveButton).toBe(false);
    expect(result.current.showCancelButton).toBe(false);
    expect(result.current.showTestButton).toBe(false);
    expect(result.current.showDeleteButton).toBe(false);
  });

  it('exposes showEditButton and showDeleteButton for non-noOp workflows in view mode', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('TestWorkflow', makeWorkflow(Type.EventBasedEntity))
    );

    expect(result.current.isViewMode).toBe(true);
    expect(result.current.isNoOp).toBe(false);
    expect(result.current.showEditButton).toBe(true);
    expect(result.current.showDeleteButton).toBe(true);
  });
});
