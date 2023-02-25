/*
 *  Copyright 2022 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { POLICY_LIST_WITH_PAGING, ROLES_LIST_WITH_PAGING } from '../Roles.mock';
import AddAttributeModal from './AddAttributeModal';

jest.mock('rest/rolesAPIV1', () => ({
  getPolicies: jest
    .fn()
    .mockImplementation(() => Promise.resolve(POLICY_LIST_WITH_PAGING)),
  getRoles: jest
    .fn()
    .mockImplementation(() => Promise.resolve(ROLES_LIST_WITH_PAGING)),
}));

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest.fn().mockReturnValue(<div data-testid="previewer">Previewer</div>)
);

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('data'),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const onSave = jest.fn();
const onCancel = jest.fn();

const mockProps = {
  type: EntityType.POLICY,
  selectedKeys: [],
  title: 'Add policy',
  isOpen: true,
  onSave,
  onCancel,
  isModalLoading: false,
};

describe('Test Add attribute modal', () => {
  it('Should render the component', async () => {
    render(<AddAttributeModal {...mockProps} />);

    const container = await screen.findByTestId('modal-container');
    const title = await screen.findByTestId('modal-title');

    const sumbitButton = await screen.findByText('Submit');
    const cancelButton = await screen.findByText('Cancel');

    expect(container).toBeInTheDocument();

    expect(title).toBeInTheDocument();

    expect(sumbitButton).toBeInTheDocument();

    expect(cancelButton).toBeInTheDocument();
  });

  it('Should render the all policy row component', async () => {
    render(<AddAttributeModal {...mockProps} />);

    const policyRows = await screen.findAllByTestId('policy-row');

    expect(policyRows).toHaveLength(4);
  });

  it('Submit button should work', async () => {
    render(<AddAttributeModal {...mockProps} />);

    const sumbitButton = await screen.findByText('Submit');

    expect(sumbitButton).toBeInTheDocument();

    act(() => {
      fireEvent.click(sumbitButton);
    });

    expect(onSave).toHaveBeenCalled();
  });

  it('Cancel button should work', async () => {
    render(<AddAttributeModal {...mockProps} />);

    const cancelButton = await screen.findByText('Cancel');

    expect(cancelButton).toBeInTheDocument();

    act(() => {
      fireEvent.click(cancelButton);
    });

    expect(onCancel).toHaveBeenCalled();
  });
});
