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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Node } from 'reactflow';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
import { CollectMetadataForm } from './CollectMetadataForm';

const FIELDS = [
  { field: 'description', rules: '{"!!":[{"var":"description"}]}' },
];

const node: Node = {
  id: 'Collect0',
  position: { x: 0, y: 0 },
  data: {
    displayName: 'Ask for missing fields',
    config: {
      stage: 'Draft',
      targetStage: 'In Review',
      fields: FIELDS,
      taskAssignees: 'owners',
      candidates: [],
    },
  },
};

const renderForm = (onSave = jest.fn()) =>
  render(
    <MemoryRouter initialEntries={['/?mode=edit']}>
      <WorkflowModeProvider>
        <CollectMetadataForm node={node} onClose={jest.fn()} onSave={onSave} />
      </WorkflowModeProvider>
    </MemoryRouter>
  );

describe('CollectMetadataForm', () => {
  it('shows the stage and its required fields by name', () => {
    renderForm();

    expect(screen.getByTestId('collect-metadata-stage')).toHaveTextContent(
      'DraftIn Review'
    );
    expect(screen.getByTestId('collect-metadata-fields')).toHaveTextContent(
      'label.description'
    );
  });

  it('saves a new assignee and keeps the stage and its fields', () => {
    const onSave = jest.fn();
    renderForm(onSave);

    fireEvent.click(screen.getByLabelText('label.reviewer-plural'));
    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(onSave).toHaveBeenCalledWith(
      'Collect0',
      expect.objectContaining({
        config: {
          stage: 'Draft',
          targetStage: 'In Review',
          fields: FIELDS,
          taskAssignees: 'reviewers',
          candidates: [],
        },
      })
    );
  });

  it('offers no reviewers for domains, which have none', () => {
    render(
      <MemoryRouter initialEntries={['/?mode=edit']}>
        <WorkflowModeProvider>
          <CollectMetadataForm
            entityTypes={['domain']}
            node={node}
            onClose={jest.fn()}
            onSave={jest.fn()}
          />
        </WorkflowModeProvider>
      </MemoryRouter>
    );

    expect(screen.getByLabelText('label.owner-plural')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('label.reviewer-plural')
    ).not.toBeInTheDocument();
  });
});
