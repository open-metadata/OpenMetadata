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
import AddPipeLineModal from './AddPipeLineModal';

const mockProps = {
  showAddEdgeModal: true,
  edgeSearchValue: '',
  selectedEdgeId: undefined,
  selectedEdge: {
    id: '1',
    source: 'table1',
    target: 'table2',
    data: {
      edge: {
        pipeline: {
          name: 'Pipeline 1',
          id: 'test-pipeline-1',
          type: 'pipeline',
          fullyQualifiedName: 'sample_airflow/presto_etl',
        },
      },
    },
  },
  onModalCancel: jest.fn(),
  onSave: jest.fn(),
  onRemoveEdgeClick: jest.fn(),
  onSearch: jest.fn(),
  onSelect: jest.fn(),
};

describe('Test CustomEdge Component', () => {
  it('AddPipeLineModal should render properly', async () => {
    render(<AddPipeLineModal {...mockProps} />);

    const edgeModal = await screen.findByTestId('add-edge-modal');
    const fieldSelect = await screen.findByTestId('field-input');
    const removeEdge = await screen.findByTestId('remove-edge-button');
    const saveButton = await screen.findByTestId('save-button');

    expect(edgeModal).toBeInTheDocument();
    expect(fieldSelect).toBeInTheDocument();
    expect(removeEdge).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
  });

  it('CTA should work properly', async () => {
    render(<AddPipeLineModal {...mockProps} />);

    const removeEdge = await screen.findByTestId('remove-edge-button');
    const saveButton = await screen.findByTestId('save-button');

    expect(removeEdge).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();

    fireEvent.click(removeEdge);
    fireEvent.click(saveButton);

    expect(mockProps.onRemoveEdgeClick).toHaveBeenCalled();
    expect(mockProps.onSave).toHaveBeenCalled();
  });
});
