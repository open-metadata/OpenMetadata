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
import { PipelineViewMode } from '../../../generated/configuration/lineageSettings';
import LineageConfigModal from './LineageConfigModal';

const onCancel = jest.fn();
const onSave = jest.fn();

const config = {
  upstreamDepth: 2,
  downstreamDepth: 3,
  nodesPerLayer: 5,
  pipelineViewMode: PipelineViewMode.Node,
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

    expect(fieldUpstream).toHaveValue(2);
    expect(fieldDownstream).toHaveValue(3);
    expect(fieldNodesPerLayer).toHaveValue(5);
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

    fireEvent.change(fieldUpstream, { target: { value: '5' } });
    fireEvent.change(fieldDownstream, { target: { value: '6' } });
    fireEvent.change(fieldNodesPerLayer, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

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

    fireEvent.change(fieldUpstream, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    expect(
      await screen.findByText('message.entity-size-less-than')
    ).toBeInTheDocument();
    expect(fieldUpstream).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
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

    fireEvent.change(fieldDownstream, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    expect(
      await screen.findByText('message.entity-size-less-than')
    ).toBeInTheDocument();
    expect(fieldDownstream).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
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

    fireEvent.change(fieldNodesPerLayer, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    expect(
      await screen.findByText('message.entity-size-less-than')
    ).toBeInTheDocument();
    expect(fieldNodesPerLayer).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
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

    fireEvent.change(fieldUpstream, { target: { value: '' } });
    fireEvent.change(fieldDownstream, { target: { value: '' } });
    fireEvent.change(fieldNodesPerLayer, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    expect(
      await screen.findAllByText('message.field-text-is-required')
    ).toHaveLength(3);
    expect(onSave).not.toHaveBeenCalled();
  });
});
