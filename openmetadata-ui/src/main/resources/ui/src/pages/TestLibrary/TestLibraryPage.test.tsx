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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TestLibraryPage from './TestLibraryPage';

jest.mock(
  '../../components/TestLibrary/TestDefinitionList/TestDefinitionList.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="test-definition-list">TestDefinitionList</div>
      )),
  })
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children, pageTitle }) => (
    <div data-testid="page-layout">
      <h1>{pageTitle}</h1>
      {children}
    </div>
  )),
}));

describe('TestLibraryPage Component', () => {
  it('should render page layout with correct title', () => {
    render(<TestLibraryPage />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByText('label.test-library')).toBeInTheDocument();
  });

  it('should render TestDefinitionList component', () => {
    render(<TestLibraryPage />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('test-definition-list')).toBeInTheDocument();
  });

  it('should render with correct layout structure', () => {
    const { container } = render(<TestLibraryPage />, {
      wrapper: MemoryRouter,
    });

    const row = container.querySelector('.ant-row');

    expect(row).toBeInTheDocument();

    const col = container.querySelector('.ant-col-24');

    expect(col).toBeInTheDocument();
  });
});
