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

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import AddCustomProperty from './AddCustomProperty';

const NAME_VALIDATION_ERROR = 'message.custom-property-name-validation';
const NAME_LENGTH_ERROR = 'message.entity-size-in-between';

const mockNavigate = jest.fn();

const mockPropertyTypes = [
  {
    id: '153a0c07-6480-404e-990b-555a42c8a7b5',
    name: 'date-cp',
    fullyQualifiedName: 'date-cp',
    displayName: 'date-cp',
    description: '"Date in ISO 8601 format in UTC. Example - \'2018-11-13\'."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/153a0c07-6480-404e-990b-555a42c8a7b5',
  },
  {
    id: '6ce245d8-80c0-4641-9b60-32cf03ca79a2',
    name: 'dateTime-cp',
    fullyQualifiedName: 'dateTime-cp',
    displayName: 'dateTime-cp',
    description:
      '"Date and time in ISO 8601 format. Example - \'2018-11-13T20:20:39+00:00\'."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/6ce245d8-80c0-4641-9b60-32cf03ca79a2',
  },
  {
    id: 'f5b7d80a-8429-4918-b092-548714ba5a0d',
    name: 'duration',
    fullyQualifiedName: 'duration',
    displayName: 'duration',
    description:
      '"Duration in ISO 8601 format in UTC. Example - \'P23DT23H\'."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/f5b7d80a-8429-4918-b092-548714ba5a0d',
  },
  {
    id: 'cb405660-95ea-4de5-a5a9-d484b612f33d',
    name: 'email',
    fullyQualifiedName: 'email',
    displayName: 'email',
    description: '"Email address of a user or other entities."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/cb405660-95ea-4de5-a5a9-d484b612f33d',
  },
  {
    id: 'be5f2241-8915-4f93-810a-d3c56fe43f29',
    name: 'integer',
    fullyQualifiedName: 'integer',
    displayName: 'integer',
    description: '"An integer type."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/be5f2241-8915-4f93-810a-d3c56fe43f29',
  },
  {
    id: '080d393a-7520-44cf-989d-14430668bc97',
    name: 'markdown',
    fullyQualifiedName: 'markdown',
    displayName: 'markdown',
    description: '"Text in Markdown format"',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/080d393a-7520-44cf-989d-14430668bc97',
  },
  {
    id: '7057cd7c-710b-4a8f-b14a-1950adf87cc0',
    name: 'number',
    fullyQualifiedName: 'number',
    displayName: 'number',
    description:
      '"A numeric type that includes integer or floating point numbers."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/7057cd7c-710b-4a8f-b14a-1950adf87cc0',
  },
  {
    id: '149f852f-c8b2-4581-84bd-e1d492836009',
    name: 'sqlQuery',
    fullyQualifiedName: 'sqlQuery',
    displayName: 'sqlQuery',
    description: '"SQL query statement. Example - \'select * from orders\'."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/149f852f-c8b2-4581-84bd-e1d492836009',
  },
  {
    id: '05e7b2f2-cf1e-4f9f-ae8b-3011372f361e',
    name: 'string',
    fullyQualifiedName: 'string',
    displayName: 'string',
    description: '"A String type."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/05e7b2f2-cf1e-4f9f-ae8b-3011372f361e',
  },
  {
    id: '5db5e3ef-b4f5-41a7-a512-8d10409d9b63',
    name: 'timeInterval',
    fullyQualifiedName: 'timeInterval',
    displayName: 'timeInterval',
    description: '"Time interval in unixTimeMillis."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/5db5e3ef-b4f5-41a7-a512-8d10409d9b63',
  },
  {
    id: '4ae124a9-c799-42cc-8bd4-048362b4b4e6',
    name: 'timestamp',
    fullyQualifiedName: 'timestamp',
    displayName: 'timestamp',
    description: '"Timestamp in Unix epoch time milliseconds."',
    category: 'field',
    nameSpace: 'basic',
    schema: '',
    version: 0.1,
    updatedAt: 1653976591924,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/metadata/types/4ae124a9-c799-42cc-8bd4-048362b4b4e6',
  },
];

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockReturnValue({
    entityTypeFQN: 'entityTypeFQN',
  }),
}));

jest.mock('../../../../rest/metadataTypeAPI', () => ({
  addPropertyToEntity: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockPropertyTypes[0])),
  getTypeByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockPropertyTypes[0])),
  getTypeListByCategory: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockPropertyTypes })),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn().mockImplementation(() => <div>BreadCrumb.component</div>)
);

jest.mock('../../../common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock('../../../common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn().mockImplementation(() => <div>ServiceDocPanel.component</div>)
);

describe('Test Add Custom Property Component', () => {
  it('Should render the child components', async () => {
    render(<AddCustomProperty />);

    // breadcrumb
    expect(screen.getByText('BreadCrumb.component')).toBeInTheDocument();

    // form
    expect(screen.getByTestId('custom-property-form')).toBeInTheDocument();

    // service doc panel
    expect(screen.getByText('ServiceDocPanel.component')).toBeInTheDocument();
  });

  it('Should render the form fields', () => {
    render(<AddCustomProperty />);

    const nameInput = screen.getByTestId('name');

    const propertyTypeSelect = screen.getByTestId('propertyType');

    const descriptionInput = screen.getByTestId('editor');

    expect(nameInput).toBeInTheDocument();
    expect(propertyTypeSelect).toBeInTheDocument();
    expect(descriptionInput).toBeInTheDocument();
  });

  it('Back button should work', () => {
    render(<AddCustomProperty />);

    const backButton = screen.getByTestId('back-button');

    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});

describe('Custom property name validation', () => {
  // These assertions previously lived as 15 Playwright browser tests
  // (Pages/CustomProperties.spec.ts). The rules are the real antd Form rules
  // wired in AddCustomProperty (pattern: CUSTOM_PROPERTY_NAME_REGEX + max: 256),
  // so they are exercised here against the real generated form fields.
  it.each([
    ['starts with a non-alphanumeric character', '_invalidName'],
    ['contains a colon', 'name:with:colon'],
    ['contains a dollar sign', 'name$invalid'],
    ['contains a caret', 'name^invalid'],
    ['contains a double quote', 'name"invalid'],
    ['contains a backslash', String.raw`name\invalid`],
    ['contains a less-than sign', 'name<<invalid'],
    ['contains a greater-than sign', 'name>>invalid'],
    ['contains an ampersand', 'name&invalid'],
    ['contains an asterisk', 'name*invalid'],
    ['contains a forward slash', 'name/invalid'],
    ['contains a tilde', 'name~invalid'],
  ])('should show the name error when the name %s', async (_, value) => {
    render(<AddCustomProperty />);

    fireEvent.change(screen.getByTestId('name'), { target: { value } });

    expect(await screen.findByText(NAME_VALIDATION_ERROR)).toBeInTheDocument();
  });

  it('should show the length error when the name exceeds 256 characters', async () => {
    render(<AddCustomProperty />);

    fireEvent.change(screen.getByTestId('name'), {
      target: { value: 'a'.repeat(257) },
    });

    expect(await screen.findByText(NAME_LENGTH_ERROR)).toBeInTheDocument();
  });

  it('should not show the name error for a valid name', async () => {
    render(<AddCustomProperty />);

    fireEvent.change(screen.getByTestId('name'), {
      target: { value: 'validName_123' },
    });

    await waitFor(() =>
      expect(
        screen.queryByText(NAME_VALIDATION_ERROR)
      ).not.toBeInTheDocument()
    );

    expect(screen.queryByText(NAME_LENGTH_ERROR)).not.toBeInTheDocument();
  });

  it('should not show the name error for a valid name with allowed special characters', async () => {
    render(<AddCustomProperty />);

    fireEvent.change(screen.getByTestId('name'), {
      target: { value: "valid Name.!@#%`()_-=+{}[]|;',.?" },
    });

    await waitFor(() =>
      expect(
        screen.queryByText(NAME_VALIDATION_ERROR)
      ).not.toBeInTheDocument()
    );
  });
});
