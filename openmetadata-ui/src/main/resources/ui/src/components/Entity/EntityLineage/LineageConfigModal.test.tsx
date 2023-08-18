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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
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
});
