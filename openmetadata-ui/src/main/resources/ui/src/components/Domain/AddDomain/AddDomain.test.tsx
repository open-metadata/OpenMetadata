/*
 *  Copyright 2024 Collate.
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
import { ERROR_MESSAGE } from '../../../constants/constants';
import { addDomains } from '../../../rest/domainAPI';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
import AddDomain from './AddDomain.component';
const formData = {
  description: 'description',
  displayName: 'Test',
  domainType: 'Aggregate',
  fullyQualifiedName: 'test',
  href: 'http://localhost:8585/api/v1/domains/66f56f68-312f-45ae-a15c-4612529cca3d',
  id: '66f56f68-312f-45ae-a15c-4612529cca3d',
  name: 'test',
  style: {
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQA…AAAAAAAAAAAAAAAAAAHgZViQAAd2fpbUAAAAASUVORK5CYII=',
  },
  updatedBy: 'admin',
  version: 0.1,
};
jest.mock('../../../rest/domainAPI', () => ({
  addDomains: jest.fn().mockImplementation(() => Promise.resolve(formData)),
}));
const error = 'error';
jest.mock('../../../utils/CommonUtils', () => ({
  getIsErrorMatch: jest.fn().mockImplementation(() => Promise.resolve(error)),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: jest.fn().mockImplementation(() => Promise.resolve({})),
}));
jest.mock('../../common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);
jest.mock('../../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn().mockImplementation(() => <div>BreadCrumb</div>)
);

jest.mock('../DomainProvider/DomainProvider', () => ({
  useDomainProvider: jest.fn().mockImplementation(() => ({
    refreshDomains: jest.fn(),
  })),
}));

jest.mock('../AddDomainForm/AddDomainForm.component', () => {
  return jest.fn().mockImplementation(({ onSubmit, onCancel }) => (
    <div>
      AddDomainForm
      <button data-testid="submit-button" onClick={() => onSubmit(formData)}>
        Submit
      </button>
      <button data-testid="cancel-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ));
});
const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

describe('AddDomain', () => {
  it('renders add domain', async () => {
    render(<AddDomain />);

    expect(await screen.findByText('BreadCrumb')).toBeInTheDocument();
    expect(await screen.findByTestId('form-heading')).toHaveTextContent(
      'label.add-entity'
    );
  });

  it('Should call onSubmit function', async () => {
    render(<AddDomain />);

    const submitButton = await screen.findByTestId('submit-button');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(addDomains as jest.Mock).toHaveBeenCalledWith(formData);
  });

  it('Should call onCancel function', async () => {
    render(<AddDomain />);

    const cancelButton = await screen.findByTestId('cancel-button');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(mockPush).toHaveBeenCalled();
  });

  it('Should show error message when api fails', async () => {
    (addDomains as jest.Mock).mockRejectedValue(error);
    render(<AddDomain />);
    const submitButton = await screen.findByTestId('submit-button');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(getIsErrorMatch as jest.Mock).toHaveBeenCalledWith(
      error,
      ERROR_MESSAGE.alreadyExist
    );
  });
});
