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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Node } from 'reactflow';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
import { EntityLifecycleStages } from '../../../../generated/api/governance/entityLifecycleStages';
import { getEntityLifecycleStages } from '../../../../rest/metadataTypeAPI';
import { getTags } from '../../../../rest/tagAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { SetActionForm } from './SetActionForm';

jest.mock('../../../../rest/metadataTypeAPI');
jest.mock('../../../../rest/tagAPI');
jest.mock('../../../../utils/ToastUtils');

const lifecycle: EntityLifecycleStages = {
  stages: ['Approved', 'In Review', 'Superseded', 'Invalidated'],
  entityTypes: [
    {
      entityType: 'table',
      stages: ['Approved', 'In Review'],
      transitions: [],
      stageWorkflows: [],
    },
    {
      entityType: 'contextMemory',
      stages: ['Approved', 'Superseded', 'Invalidated'],
      transitions: [],
      stageWorkflows: [],
    },
  ],
};

const node: Node = {
  id: 'set-status',
  position: { x: 0, y: 0 },
  data: {
    displayName: 'Set status',
    config: { fieldName: 'status', fieldValue: 'Superseded' },
  },
};

const form = (
  entityTypes: string[],
  onSave = jest.fn(),
  formNode: Node = node
) => (
  <MemoryRouter initialEntries={['/?mode=edit']}>
    <WorkflowModeProvider>
      <SetActionForm
        entityTypes={entityTypes}
        node={formNode}
        onClose={jest.fn()}
        onSave={onSave}
      />
    </WorkflowModeProvider>
  </MemoryRouter>
);

const renderForm = (entityTypes: string[], onSave = jest.fn()) =>
  render(form(entityTypes, onSave));

describe('workflow lifecycle status options', () => {
  beforeEach(() => {
    (
      getEntityLifecycleStages as jest.MockedFunction<
        typeof getEntityLifecycleStages
      >
    )
      .mockReset()
      .mockResolvedValue(lifecycle);
  });

  it('loads the memory vocabulary and saves its own status code', async () => {
    const onSave = jest.fn();
    renderForm(['contextMemory'], onSave);
    const save = screen.getByTestId('save-node-configuration-button');

    expect(save).toBeDisabled();

    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledWith(
      'set-status',
      expect.objectContaining({
        config: expect.objectContaining({
          fieldName: 'status',
          fieldValue: 'Superseded',
        }),
      })
    );
  });

  it('keeps a memory-only status from being saved for a mixed target workflow', async () => {
    renderForm(['table', 'contextMemory']);
    const select = screen.getByTestId('field-value-select');
    await waitFor(() =>
      expect(within(select).getByRole('button')).toBeEnabled()
    );
    fireEvent.click(within(select).getByRole('button'));
    await screen.findByRole('option', { name: 'Approved' });

    expect(
      screen.queryByRole('option', { name: 'Superseded' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'In Review' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('save-node-configuration-button')).toBeDisabled();
  });

  it('keeps current target choices when an older discovery request finishes last', async () => {
    let resolveOlder!: (value: EntityLifecycleStages) => void;
    const older = new Promise<EntityLifecycleStages>((resolve) => {
      resolveOlder = resolve;
    });
    (
      getEntityLifecycleStages as jest.MockedFunction<
        typeof getEntityLifecycleStages
      >
    ).mockReturnValueOnce(older);
    const view = renderForm(['contextMemory']);
    view.rerender(form(['table']));
    const select = screen.getByTestId('field-value-select');
    await waitFor(() =>
      expect(within(select).getByRole('button')).toBeEnabled()
    );
    await act(async () => {
      resolveOlder(lifecycle);
    });
    fireEvent.click(within(select).getByRole('button'));
    await screen.findByRole('option', { name: 'In Review' });

    expect(
      screen.queryByRole('option', { name: 'Superseded' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('save-node-configuration-button')).toBeDisabled();
  });

  it('keeps status writes disabled when discovery fails', async () => {
    const error = new Error('Discovery unavailable');
    (
      getEntityLifecycleStages as jest.MockedFunction<
        typeof getEntityLifecycleStages
      >
    ).mockRejectedValue(error);
    renderForm(['contextMemory']);
    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(screen.getByTestId('save-node-configuration-button')).toBeDisabled();
  });
});

describe('workflow certification value', () => {
  const certificationNode: Node = {
    id: 'set-certification',
    position: { x: 0, y: 0 },
    data: {
      displayName: 'Set certification',
      config: { fieldName: 'certification', fieldValue: 'Certification.Gold' },
    },
  };

  beforeEach(() => {
    (getTags as jest.MockedFunction<typeof getTags>).mockResolvedValue({
      data: [
        {
          id: 'gold-id',
          name: 'Gold',
          displayName: 'Gold',
          fullyQualifiedName: 'Certification.Gold',
          description: '',
        },
        {
          id: 'silver-id',
          name: 'Silver',
          displayName: 'Silver',
          fullyQualifiedName: 'Certification.Silver',
          description: '',
        },
      ],
      paging: { total: 2 },
    });
  });

  it('picks the value through the shared certification picker', async () => {
    const onSave = jest.fn();
    render(form(['table'], onSave, certificationNode));

    const trigger = await screen.findByRole('button', { name: 'Gold' });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByTestId('Certification.Silver'));
    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(onSave).toHaveBeenCalledWith(
      'set-certification',
      expect.objectContaining({
        config: expect.objectContaining({
          fieldName: 'certification',
          fieldValue: 'Certification.Silver',
        }),
      })
    );
  });
});
