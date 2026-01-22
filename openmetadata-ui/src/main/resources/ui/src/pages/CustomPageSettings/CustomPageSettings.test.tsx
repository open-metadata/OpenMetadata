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
import React from 'react';
import { CustomPageSettings } from './CustomPageSettings';

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  Link: jest.fn().mockImplementation(({ to }) => <a href={to}>Link</a>),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockReturnValue({ theme: { primaryColor: 'blue' } }),
}));

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    pageSize: 10,
    paging: {},
    handlePagingChange: jest.fn(),
    showPagination: false,
    pagingCursor: null,
  }),
}));

jest.mock('../../rest/PersonaAPI', () => ({
  getAllPersonas: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);

jest.mock('../../components/common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious</div>);
});

jest.mock('../../utils/CommonUtils', () => ({
  Transi18next: jest.fn().mockReturnValue(<div>Transi18next</div>),
}));

jest.mock('../../components/PageHeader/PageHeader.component', () => {
  return jest.fn().mockImplementation(({ children, data }) => (
    <div data-testid="page-header">
      <div>{data.header}</div>
      <div>{data.subHeader}</div>
      {children}
    </div>
  ));
});

describe('CustomPageSettings', () => {
  it('should render PageHeader', async () => {
    // Use act to handle state updates if necessary, but for static render check it might be fine
    // Since getAllPersonas is async and sets state, we might get act warning, but we care about Header

    render(<CustomPageSettings />);

    // Check for PageHeader
    const pageHeader = await screen.findByTestId('page-header');

    expect(pageHeader).toBeInTheDocument();
  });
});
