/*
 *  Copyright 2021 Collate
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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AddPipeLineModal from './AddPipeLineModal';

const mockProps = {
  showAddPipelineModal: true,
  pipelineSearchValue: '',
  selectedPipelineId: undefined,
  pipelineOptions: [
    {
      displayName: 'Pipeline 1',
      name: 'Pipeline 1',
      id: 'test-pipeline-1',
      type: 'pipeline',
    },
  ],
  handleModalCancel: jest.fn(),
  handleModalSave: jest.fn(),
  onClear: jest.fn(),
  handleRemoveEdgeClick: jest.fn(),
  onSearch: jest.fn(),
  onSelect: jest.fn(),
};

describe('Test CustomEdge Component', () => {
  it('AddPipeLineModal should render properly', async () => {
    render(<AddPipeLineModal {...mockProps} />);

    const pipelineModal = await screen.findByTestId('add-pipeline-modal');
    const fieldSelect = await screen.findByTestId('field-select');
    const removeEdge = await screen.findByTestId('remove-edge-button');
    const saveButton = await screen.findByTestId('save-button');

    expect(pipelineModal).toBeInTheDocument();
    expect(fieldSelect).toBeInTheDocument();
    expect(removeEdge).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
  });

  it('CTA should work properly', async () => {
    render(
      <AddPipeLineModal {...mockProps} selectedPipelineId="test-pipeline-1" />
    );

    const removeEdge = await screen.findByTestId('remove-edge-button');
    const saveButton = await screen.findByTestId('save-button');

    expect(removeEdge).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();

    userEvent.click(removeEdge);
    userEvent.click(saveButton);

    expect(mockProps.handleRemoveEdgeClick).toHaveBeenCalled();
    expect(mockProps.handleModalSave).toHaveBeenCalled();
  });
});
