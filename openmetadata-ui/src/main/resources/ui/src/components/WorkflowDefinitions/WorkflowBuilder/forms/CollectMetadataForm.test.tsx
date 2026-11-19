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
import { EntityType } from '../../../../enums/entity.enum';
import { CollectMetadataForm } from './CollectMetadataForm';

jest.mock('./QueryBuilderSection', () => ({
  QueryBuilderSection: ({
    forceReadOnly,
    value,
  }: {
    forceReadOnly?: boolean;
    value: string;
  }) => (
    <div data-readonly={String(forceReadOnly)} data-testid="query-builder">
      {value}
    </div>
  ),
}));

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

const CONDITIONS =
  '{"some":[{"var":"owners"},{"==":[{"var":"name"},"admin"]}]}';

const renderForm = (onSave = jest.fn(), formNode = node) =>
  render(
    <MemoryRouter initialEntries={['/?mode=edit']}>
      <WorkflowModeProvider>
        <CollectMetadataForm
          node={formNode}
          onClose={jest.fn()}
          onSave={onSave}
        />
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

  it('warns that the admins are asked while the asked group is itself a required field', () => {
    renderForm(jest.fn(), {
      ...node,
      data: {
        ...node.data,
        config: {
          ...node.data.config,
          fields: [
            ...FIELDS,
            {
              field: 'owners',
              rules:
                '{"some":[{"var":"owners"},{"!=":[{"var":"fullyQualifiedName"},null]}]}',
            },
          ],
        },
      },
    });

    expect(
      screen.getByTestId('collect-metadata-asks-required-group')
    ).toHaveTextContent('message.collect-metadata-asks-required-group');

    fireEvent.click(screen.getByLabelText('label.reviewer-plural'));

    expect(
      screen.queryByTestId('collect-metadata-asks-required-group')
    ).not.toBeInTheDocument();
  });

  it('offers no reviewers for domains, which have none', () => {
    render(
      <MemoryRouter initialEntries={['/?mode=edit']}>
        <WorkflowModeProvider>
          <CollectMetadataForm
            entityTypes={[EntityType.DOMAIN]}
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

  it('shows a condition-only stage read-only and keeps its conditions on save', () => {
    const onSave = jest.fn();
    renderForm(onSave, {
      ...node,
      data: {
        ...node.data,
        config: {
          stage: 'Draft',
          targetStage: 'In Review',
          conditions: CONDITIONS,
          taskAssignees: 'owners',
          candidates: [],
        },
      },
    });

    expect(
      screen.queryByTestId('collect-metadata-fields')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('query-builder')).toHaveAttribute(
      'data-readonly',
      'true'
    );

    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(onSave).toHaveBeenCalledWith(
      'Collect0',
      expect.objectContaining({
        config: expect.objectContaining({ conditions: CONDITIONS }),
      })
    );
  });

  const revisionNode = (revision: string): Node => ({
    ...node,
    id: `Revision_${revision}`,
    data: {
      displayName: 'Revision step',
      config: {
        stage: 'In Review',
        targetStage: 'Approved',
        fields: [],
        taskAssignees: 'owners',
        candidates: [],
        revision,
      },
    },
  });

  it('describes a revision request and asks who gets it', () => {
    const onSave = jest.fn();
    renderForm(onSave, revisionNode('request'));

    expect(screen.getByTestId('collect-metadata-revision')).toHaveTextContent(
      'message.collect-metadata-revision-request-hint'
    );
    expect(
      screen.getByTestId('collect-metadata-assignees')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.collect-metadata-revision-assignees-hint')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(onSave).toHaveBeenCalledWith(
      'Revision_request',
      expect.objectContaining({
        config: expect.objectContaining({ revision: 'request' }),
      })
    );
  });

  it('describes a resubmit step without asking anyone', () => {
    renderForm(jest.fn(), revisionNode('resubmit'));

    expect(screen.getByTestId('collect-metadata-revision')).toHaveTextContent(
      'message.collect-metadata-revision-resubmit-hint'
    );
    expect(
      screen.queryByTestId('collect-metadata-assignees')
    ).not.toBeInTheDocument();
  });

  it('neither offers nor requires specific users on a resubmit step', () => {
    const onSave = jest.fn();
    const resubmit = revisionNode('resubmit');
    renderForm(onSave, {
      ...resubmit,
      data: {
        ...resubmit.data,
        config: { ...resubmit.data.config, taskAssignees: 'candidates' },
      },
    });

    expect(
      screen.queryByTestId('collect-metadata-candidates-trigger')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(onSave).toHaveBeenCalledWith(
      'Revision_resubmit',
      expect.objectContaining({
        config: expect.objectContaining({ candidates: [] }),
      })
    );
  });
});
