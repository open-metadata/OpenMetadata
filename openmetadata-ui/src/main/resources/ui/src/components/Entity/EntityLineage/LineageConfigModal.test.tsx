/*
 *  Copyright 2023 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineViewMode } from '../../../generated/configuration/lineageSettings';
import LineageConfigModal from './LineageConfigModal';

const onCancel = jest.fn();
const onSave = jest.fn();
let user: ReturnType<typeof userEvent.setup>;

const config = {
  upstreamDepth: 2,
  downstreamDepth: 3,
  nodesPerLayer: 6,
  pipelineViewMode: PipelineViewMode.Node,
};

describe('LineageConfigModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  });

  it('renders the modal with pre-populated values', async () => {
    render(
      <LineageConfigModal
        visible
        config={config}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    const fieldUpstream = await screen.findByTestId('field-upstream');
    const fieldDownstream = await screen.findByTestId('field-downstream');
    const fieldNodesPerLayer = await screen.findByTestId(
      'field-nodes-per-layer'
    );

    expect(fieldUpstream).toBeInTheDocument();
    expect(fieldDownstream).toBeInTheDocument();
    expect(fieldNodesPerLayer).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(
      <LineageConfigModal
        visible
        config={config}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with updated values when form is submitted', async () => {
    render(
      <LineageConfigModal
        visible
        config={config}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    const fieldUpstream = await screen.findByTestId('field-upstream');
    const fieldDownstream = await screen.findByTestId('field-downstream');
    const fieldNodesPerLayer = await screen.findByTestId(
      'field-nodes-per-layer'
    );

    await user.clear(fieldUpstream);
    await user.type(fieldUpstream, '5');
    await user.clear(fieldDownstream);
    await user.type(fieldDownstream, '6');
    await user.clear(fieldNodesPerLayer);
    await user.type(fieldNodesPerLayer, '7');

    await user.click(screen.getByRole('button', { name: 'label.ok' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        upstreamDepth: 5,
        downstreamDepth: 6,
        nodesPerLayer: 7,
      });
    });
  });

  it('validates minimum value for upstream depth', async () => {
    render(
      <LineageConfigModal
        visible
        config={config}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    const fieldUpstream = await screen.findByTestId('field-upstream');

    await user.clear(fieldUpstream);
    await user.type(fieldUpstream, '-1');

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    await waitFor(() => {
      expect(fieldUpstream).toHaveAttribute('aria-invalid', 'true');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('validates minimum value for downstream depth', async () => {
    render(
      <LineageConfigModal
        visible
        config={config}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    const fieldDownstream = await screen.findByTestId('field-downstream');

    // Try to set negative value
    await user.clear(fieldDownstream);
    await user.type(fieldDownstream, '-1');

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    await waitFor(() => {
      expect(fieldDownstream).toHaveAttribute('aria-invalid', 'true');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('validates minimum value for nodes per layer', async () => {
    render(
      <LineageConfigModal
        visible
        config={config}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    const fieldNodesPerLayer = await screen.findByTestId(
      'field-nodes-per-layer'
    );

    await user.clear(fieldNodesPerLayer);
    await user.type(fieldNodesPerLayer, '4');

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    await waitFor(() => {
      expect(fieldNodesPerLayer).toHaveAttribute('aria-invalid', 'true');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('validates required fields', async () => {
    render(
      <LineageConfigModal
        visible
        config={config}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    const fieldUpstream = await screen.findByTestId('field-upstream');
    const fieldDownstream = await screen.findByTestId('field-downstream');
    const fieldNodesPerLayer = await screen.findByTestId(
      'field-nodes-per-layer'
    );

    await user.clear(fieldUpstream);
    await user.tab();
    await user.clear(fieldDownstream);
    await user.tab();
    await user.clear(fieldNodesPerLayer);
    await user.tab();

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
