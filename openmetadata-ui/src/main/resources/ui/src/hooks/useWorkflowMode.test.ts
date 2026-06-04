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

import { act, renderHook } from '@testing-library/react';
import {
  Type,
  WorkflowDefinition,
} from '../generated/governance/workflows/workflowDefinition';
import { useWorkflowMode } from './useWorkflowMode';

const mockSetSearchParams = jest.fn();

jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}));

jest.mock('../utils/WorkflowClassBase', () => ({
  __esModule: true,
  default: {
    getCapabilities: () => ({
      allowCreateWorkflow: true,
      allowDeleteWorkflow: true,
      allowStructuralGraphEdits: true,
      showWorkflowNodePalette: true,
      allowFullStartNodeConfiguration: true,
      allowStartNodeFilterScheduleAndBatchEdit: true,
      allowScheduledTrigger: true,
      allowViewModeDrag: true,
    }),
  },
}));

const noOpWorkflow = {
  name: 'test-no-op',
  description: '',
  trigger: { type: Type.NoOp } as WorkflowDefinition['trigger'],
  nodes: [],
  edges: [],
} as unknown as WorkflowDefinition;

const regularWorkflow = {
  name: 'test-regular',
  description: '',
  trigger: {
    type: Type.EventBasedEntity,
  } as WorkflowDefinition['trigger'],
  nodes: [],
  edges: [],
} as unknown as WorkflowDefinition;

describe('useWorkflowMode — initial mode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts in view mode when a workflowFqn is provided', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    expect(result.current.isViewMode).toBe(true);
    expect(result.current.isEditMode).toBe(false);
  });

  it('starts in edit mode when no workflowFqn is provided (new workflow)', () => {
    const { result } = renderHook(() => useWorkflowMode(undefined, undefined));

    expect(result.current.isEditMode).toBe(true);
    expect(result.current.isViewMode).toBe(false);
  });
});

describe('useWorkflowMode — mode transitions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enterEditMode switches from view to edit', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    expect(result.current.isViewMode).toBe(true);

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.isEditMode).toBe(true);
    expect(result.current.isViewMode).toBe(false);
  });

  it('enterViewMode switches from edit to view', () => {
    const { result } = renderHook(() => useWorkflowMode(undefined, undefined));

    expect(result.current.isEditMode).toBe(true);

    act(() => {
      result.current.enterViewMode();
    });

    expect(result.current.isViewMode).toBe(true);
    expect(result.current.isEditMode).toBe(false);
  });

  it('toggleMode flips from view to edit', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.isEditMode).toBe(true);
  });

  it('toggleMode flips from edit to view', () => {
    const { result } = renderHook(() => useWorkflowMode(undefined, undefined));

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.isViewMode).toBe(true);
  });
});

describe('useWorkflowMode — allowStructuralGraphEdits', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is false in view mode even when the capability is enabled', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    expect(result.current.isViewMode).toBe(true);
    expect(result.current.allowStructuralGraphEdits).toBe(false);
  });

  it('is true in edit mode for a non-noOp workflow with the capability enabled', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.allowStructuralGraphEdits).toBe(true);
  });

  it('is false in edit mode for a noOp workflow', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', noOpWorkflow)
    );

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.isEditMode).toBe(true);
    expect(result.current.allowStructuralGraphEdits).toBe(false);
  });

  it('is false in view mode for a noOp workflow', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', noOpWorkflow)
    );

    expect(result.current.isViewMode).toBe(true);
    expect(result.current.allowStructuralGraphEdits).toBe(false);
  });

  it('returns to false when switching back to view mode after edit', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.allowStructuralGraphEdits).toBe(true);

    act(() => {
      result.current.enterViewMode();
    });

    expect(result.current.allowStructuralGraphEdits).toBe(false);
  });
});

describe('useWorkflowMode — noOp workflow restrictions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hides the Edit button for noOp workflows in view mode', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', noOpWorkflow)
    );

    expect(result.current.showEditButton).toBe(false);
  });

  it('shows the Edit button for regular workflows in view mode', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    expect(result.current.showEditButton).toBe(true);
  });

  it('canEdit is false in edit mode for noOp workflows', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', noOpWorkflow)
    );

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.canEdit).toBe(false);
  });

  it('canEdit is true in edit mode for regular workflows', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.canEdit).toBe(true);
  });
});

describe('useWorkflowMode — view mode restrictions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('isFormDisabled is true in view mode', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    expect(result.current.isFormDisabled).toBe(true);
  });

  it('isFormDisabled is false in edit mode', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.isFormDisabled).toBe(false);
  });

  it('canDelete is false in edit mode', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    act(() => {
      result.current.enterEditMode();
    });

    expect(result.current.canDelete).toBe(false);
  });

  it('canDelete is true in view mode for a regular workflow', () => {
    const { result } = renderHook(() =>
      useWorkflowMode('some-fqn', regularWorkflow)
    );

    expect(result.current.canDelete).toBe(true);
  });
});
