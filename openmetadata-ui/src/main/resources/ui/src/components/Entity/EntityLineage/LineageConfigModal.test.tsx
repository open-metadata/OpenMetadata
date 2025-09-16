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
import LineageConfigModal from './LineageConfigModal';

const onCancel = jest.fn();
const onSave = jest.fn();

const config = {
  upstreamDepth: 2,
  downstreamDepth: 3,
  nodesPerLayer: 4,
};

describe('LineageConfigModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

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

    // Update values
    fireEvent.change(fieldUpstream, { target: { value: '5' } });
    fireEvent.change(fieldDownstream, { target: { value: '6' } });
    fireEvent.change(fieldNodesPerLayer, { target: { value: '7' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

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

    // Try to set negative value
    fireEvent.change(fieldUpstream, { target: { value: '-1' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
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
    fireEvent.change(fieldDownstream, { target: { value: '-1' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
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

    // Try to set value less than minimum (5)
    fireEvent.change(fieldNodesPerLayer, { target: { value: '4' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
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

    // Clear all fields
    fireEvent.change(fieldUpstream, { target: { value: '' } });
    fireEvent.change(fieldDownstream, { target: { value: '' } });
    fireEvent.change(fieldNodesPerLayer, { target: { value: '' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
