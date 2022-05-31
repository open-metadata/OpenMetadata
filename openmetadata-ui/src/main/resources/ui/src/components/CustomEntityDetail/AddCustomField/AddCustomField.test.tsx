/*
 *  Copyright 2021 Collate
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

import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { addFieldToEntity } from '../../../axiosAPIs/metadataTypeAPI';
import AddCustomField from './AddCustomField';

const mockFieldTypes = [
  {
    id: '153a0c07-6480-404e-990b-555a42c8a7b5',
    name: 'date',
    fullyQualifiedName: 'date',
    displayName: 'date',
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
    name: 'dateTime',
    fullyQualifiedName: 'dateTime',
    displayName: 'dateTime',
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
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    entityTypeFQN: 'entityTypeFQN',
  }),
}));

jest.mock('../../../axiosAPIs/metadataTypeAPI', () => ({
  addFieldToEntity: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockFieldTypes[0] })),
  getTypeByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockFieldTypes[0] })),
  getTypeListByCategory: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: { data: mockFieldTypes } })
    ),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  errorMsg: jest.fn(),
  requiredField: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../common/rich-text-editor/RichTextEditor', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="richtext-editor">RichTextEditor</div>);
});

jest.mock('../../containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ));
});

jest.mock(
  '../../containers/PageLayout',
  () =>
    ({
      children,
      rightPanel,
    }: {
      children: React.ReactNode;
      rightPanel: React.ReactNode;
    }) =>
      (
        <div data-testid="PageLayout">
          <div data-testid="right-panel-content">{rightPanel}</div>
          {children}
        </div>
      )
);

describe('Test Add Custom Field Component', () => {
  it('Should render component', async () => {
    const { container } = render(<AddCustomField />, {
      wrapper: MemoryRouter,
    });

    const rightPanel = await findByTestId(container, 'right-panel-content');

    expect(rightPanel).toBeInTheDocument();

    const formContainer = await findByTestId(container, 'form-container');

    expect(formContainer).toBeInTheDocument();

    const nameField = await findByTestId(container, 'name');

    const typeField = await findByTestId(container, 'type');

    const descriptionField = await findByTestId(container, 'richtext-editor');

    const backButton = await findByTestId(container, 'cancel-custom-field');

    const createButton = await findByTestId(container, 'create-custom-field');

    expect(nameField).toBeInTheDocument();
    expect(typeField).toBeInTheDocument();
    expect(descriptionField).toBeInTheDocument();

    expect(backButton).toBeInTheDocument();
    expect(createButton).toBeInTheDocument();
  });

  it('Test create field flow', async () => {
    const { container } = render(<AddCustomField />, {
      wrapper: MemoryRouter,
    });

    const formContainer = await findByTestId(container, 'form-container');

    expect(formContainer).toBeInTheDocument();

    const nameField = await findByTestId(container, 'name');

    const typeField = await findByTestId(container, 'type');

    const descriptionField = await findByTestId(container, 'richtext-editor');

    const backButton = await findByTestId(container, 'cancel-custom-field');

    const createButton = await findByTestId(container, 'create-custom-field');

    expect(nameField).toBeInTheDocument();
    expect(typeField).toBeInTheDocument();
    expect(descriptionField).toBeInTheDocument();

    expect(backButton).toBeInTheDocument();
    expect(createButton).toBeInTheDocument();

    fireEvent.change(nameField, { target: { value: 'updatedBy' } });
    fireEvent.change(typeField, {
      target: { value: '05e7b2f2-cf1e-4f9f-ae8b-3011372f361e' },
    });

    fireEvent.click(createButton);

    expect(addFieldToEntity).toBeCalled();
  });
});
