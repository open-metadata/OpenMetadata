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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Type } from '../../generated/entity/type';
import { Tab } from '../common/TabsPane/TabsPane';
import CustomEntityDetail from './CustomEntityDetail';

const mockData = {
  id: '32f81349-d7d7-4a6a-8fc7-d767f233b674',
  name: 'table',
  fullyQualifiedName: 'table',
  displayName: 'table',
  description:
    // eslint-disable-next-line max-len
    '"This schema defines the Table entity. A Table organizes data in rows and columns and is defined by a Schema. OpenMetadata does not have a separate abstraction for Schema. Both Table and Schema are captured in this entity."',
  category: 'entity',
  nameSpace: 'data',
  schema: '',
  version: 0.1,
  updatedAt: 1653626359971,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/metadata/types/32f81349-d7d7-4a6a-8fc7-d767f233b674',
} as Type;

const mockPush = jest.fn();

const MOCK_HISTORY = {
  push: mockPush,
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => MOCK_HISTORY),
}));

jest.mock('../../axiosAPIs/metadataTypeAPI', () => ({
  getTypeByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockData })),
}));

jest.mock('../containers/PageContainer', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ));
});

jest.mock('../../constants/constants', () => ({
  getAddCustomPropertyPath: jest.fn().mockReturnValue('/custom-entity/table'),
}));

jest.mock('../common/TabsPane/TabsPane', () =>
  jest.fn().mockImplementation(({ setActiveTab, tabs }) => {
    return (
      <div>
        <nav
          className="tw-flex tw-items-center tw-justify-between tw-gh-tabs-container tw-px-7"
          data-testid="tabs"
          id="tabs">
          {tabs.map((tab: Tab) => (
            <button
              data-testid={tab.name}
              key={tab.position}
              onClick={() => setActiveTab?.(tab.position)}>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>
    );
  })
);

jest.mock('../schema-editor/SchemaEditor', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="schema-editor">Schema Editor</div>)
);

jest.mock('./CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(
      <div data-testid="CustomPropertyTable">CustomPropertyTable</div>
    ),
}));

jest.mock('./LeftPanel', () => ({
  LeftPanel: jest
    .fn()
    .mockReturnValue(<div data-testid="LeftPanel">LeftPanel</div>),
}));

describe('Test Custom Entity Detail Component', () => {
  it('Should render custom entity component', async () => {
    const { findByTestId } = render(
      <CustomEntityDetail entityTypes={[mockData]} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const leftPanel = await findByTestId('LeftPanel');
    const tabContainer = await findByTestId('tabs');

    const schemaTab = await findByTestId('Schema');
    const customPropertiesTab = await findByTestId('Custom Properties');

    expect(leftPanel).toBeInTheDocument();
    expect(tabContainer).toBeInTheDocument();
    expect(schemaTab).toBeInTheDocument();
    expect(customPropertiesTab).toBeInTheDocument();
  });

  it('Should render custom fields table if active tab is Custom Fields', async () => {
    const { findByTestId } = render(
      <CustomEntityDetail entityTypes={[mockData]} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const leftPanel = await findByTestId('LeftPanel');
    const tabContainer = await findByTestId('tabs');

    expect(leftPanel).toBeInTheDocument();
    expect(tabContainer).toBeInTheDocument();

    const customPropertiesTab = await findByTestId('Custom Properties');

    expect(customPropertiesTab).toBeInTheDocument();

    fireEvent.click(customPropertiesTab);

    expect(await findByTestId('CustomPropertyTable')).toBeInTheDocument();
  });

  it('Should call history.push method on click of Add field button', async () => {
    const { findByTestId } = render(
      <CustomEntityDetail entityTypes={[mockData]} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tabContainer = await findByTestId('tabs');

    expect(tabContainer).toBeInTheDocument();

    const customPropertiesTab = await findByTestId('Custom Properties');

    expect(customPropertiesTab).toBeInTheDocument();

    fireEvent.click(customPropertiesTab);

    expect(await findByTestId('CustomPropertyTable')).toBeInTheDocument();

    const addFieldButton = await findByTestId('add-field-button');

    expect(addFieldButton).toBeInTheDocument();

    fireEvent.click(addFieldButton);

    expect(mockPush).toHaveBeenCalled();
  });
});
