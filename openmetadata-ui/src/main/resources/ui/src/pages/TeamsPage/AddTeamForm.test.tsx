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
import { act, fireEvent, render } from '@testing-library/react';
import { TeamType } from '../../generated/entity/teams/team';
import AddTeamForm from './AddTeamForm';

const mockCancel = jest.fn();
const mockSave = jest.fn();

jest.mock('../../constants/constants', () => ({
  VALIDATION_MESSAGES: [],
}));

jest.mock('../../utils/RouterUtils', () => ({
  getDomainPath: jest.fn(),
}));

jest.mock('../../components/common/DomainLabel/DomainLabel.component', () => ({
  DomainLabel: jest.fn().mockImplementation(() => <div>DomainLabel</div>),
}));

jest.mock('../../utils/formUtils', () => ({
  getField: jest
    .fn()
    .mockImplementation(({ name }) => <div data-testid={name}>{name}</div>),
}));

jest.mock('../../utils/TeamUtils', () => ({
  getTeamOptionsFromType: jest.fn().mockImplementation(() => [
    {
      label: 'Organization',
      value: TeamType.Organization,
      type: TeamType.Organization,
    },
  ]),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../hooks/useDomainStore', () => ({
  useDomainStore: jest.fn().mockImplementation(() => ({
    activeDomainEntityRef: {
      id: '1',
      type: 'domain',
    },
  })),
}));

describe('AddTeamForm component', () => {
  it('should render form with required fields', () => {
    const { getByTestId } = render(
      <AddTeamForm
        visible
        isLoading={false}
        parentTeamType={TeamType.Organization}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );

    expect(getByTestId('name')).toBeInTheDocument();
    expect(getByTestId('email')).toBeInTheDocument();
    expect(getByTestId('description')).toBeInTheDocument();
    expect(getByTestId('team-selector')).toBeInTheDocument();
    expect(getByTestId('isJoinable')).toBeInTheDocument();
  });

  it('should call onCancel function when cancel button is clicked', () => {
    const { getByText } = render(
      <AddTeamForm
        visible
        isLoading={false}
        parentTeamType={TeamType.Organization}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );

    getByText('Cancel').click();

    expect(mockCancel).toHaveBeenCalled();
  });

  it('should call onSave function when save button is clicked', async () => {
    const { getByText, getByTestId } = render(
      <AddTeamForm
        visible
        isLoading={false}
        parentTeamType={TeamType.Organization}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );

    // input name
    const nameInput = getByTestId('name');
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'test' } });
    });

    // input displayName
    const displayNameInput = getByTestId('display-name');
    await act(async () => {
      fireEvent.change(displayNameInput, { target: { value: 'Test Team' } });
    });

    // input email
    const emailInput = getByTestId('email');
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'testteam@gmail.com' } });
    });

    // save form
    const saveButton = getByText('label.save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockSave).toHaveBeenCalledWith({
      name: 'test',
      displayName: 'Test Team',
      email: 'testteam@gmail.com',
      description: '',
      teamType: 'Group',
    });
  });

  it('should call onSave function when save button is clicked with isJoinable default value', async () => {
    const { getByText, getByTestId } = render(
      <AddTeamForm
        visible
        isLoading={false}
        parentTeamType={TeamType.Organization}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );

    // input name
    const nameInput = getByTestId('name');
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'test' } });
    });

    // input displayName
    const displayNameInput = getByTestId('display-name');
    await act(async () => {
      fireEvent.change(displayNameInput, { target: { value: 'Test Team' } });
    });

    // save form
    const saveButton = getByText('label.save');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockSave).toHaveBeenCalledWith({
      name: 'test',
      displayName: 'Test Team',
      email: undefined,
      description: '',
      teamType: 'Group',
    });
  });
});
