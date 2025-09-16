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
import { render, screen } from '@testing-library/react';
import { MOCK_TABLE } from '../../mocks/TableData.mock';
import AddQueryPage from './AddQueryPage.component';

jest.mock('../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_TABLE })),
}));
jest.mock('../../rest/queryAPI', () => ({
  postQuery: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('../../rest/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({ fqn: MOCK_TABLE.fullyQualifiedName }),
  useNavigate: jest.fn(),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);
jest.mock('../../components/Database/SchemaEditor/SchemaEditor', () => {
  return jest.fn().mockImplementation(() => <div>SchemaEditor</div>);
});
jest.mock('../../components/common/RichTextEditor/RichTextEditor', () => {
  return jest.fn().mockImplementation(() => <div>RichTextEditor</div>);
});
jest.mock('../../components/common/AsyncSelect/AsyncSelect', () => ({
  AsyncSelect: jest.fn().mockImplementation(() => <div>AsyncSelect</div>),
}));
jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      query: {
        Create: true,
      },
    },
  })),
}));

const mockProps = {
  pageTitle: 'add-query',
};

describe('AddQueryPage test', () => {
  it('Component should render', async () => {
    render(<AddQueryPage {...mockProps} />);

    expect(await screen.findByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(await screen.findByText('SchemaEditor')).toBeInTheDocument();
    expect(await screen.findByText('RichTextEditor')).toBeInTheDocument();
    expect(await screen.findByText('AsyncSelect')).toBeInTheDocument();
    expect(await screen.findByTestId('form-title')).toBeInTheDocument();
    expect(await screen.findByTestId('query-form')).toBeInTheDocument();
    expect(
      await screen.findByTestId('sql-editor-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('cancel-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('save-btn')).toBeInTheDocument();
  });
});
