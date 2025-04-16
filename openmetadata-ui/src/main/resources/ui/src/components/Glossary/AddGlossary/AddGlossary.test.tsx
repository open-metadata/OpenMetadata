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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import AddGlossary from './AddGlossary.component';

jest.mock('../../MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

jest.mock('../../../rest/glossaryAPI', () => ({
  addGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const mockProps = {
  header: 'Header',
  allowAccess: true,
  isLoading: false,
  onCancel: mockOnCancel,
  onSave: mockOnSave,
  slashedBreadcrumb: [],
};

describe('Test AddGlossary component', () => {
  it('AddGlossary component should render', () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const addGlossaryForm = getByTestId(container, 'add-glossary');

    expect(addGlossaryForm).toBeInTheDocument();
  });

  it('should be able to cancel', () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const cancelButton = getByTestId(container, 'cancel-glossary');

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(
      cancelButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnCancel).toHaveBeenCalled();
  });
});
