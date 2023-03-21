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
import { Query } from 'generated/entity/data/query';
import { MOCK_QUERIES } from 'mocks/Queries.mock';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import TableQueryRightPanel from './TableQueryRightPanel.component';
import { TableQueryRightPanelProps } from './TableQueryRightPanel.interface';

const mockProps: TableQueryRightPanelProps = {
  query: MOCK_QUERIES[0] as Query,
  isLoading: false,
  permission: DEFAULT_ENTITY_PERMISSION,
  onQueryUpdate: jest.fn(),
};

jest.mock('components/Tag/TagsViewer/tags-viewer', () => {
  return jest.fn().mockImplementation(() => <div>TagsViewer.component</div>);
});
jest.mock('components/Tag/TagsContainer/tags-container', () => {
  return jest.fn().mockImplementation(() => <div>TagsContainer.component</div>);
});
jest.mock('components/common/OwnerWidget/OwnerWidgetWrapper.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>OwnerWidgetWrapper.component</div>);
});
jest.mock('components/common/description/Description', () => {
  return jest.fn().mockImplementation(() => <div>Description.component</div>);
});
jest.mock('utils/TagsUtils', () => ({
  getClassifications: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  fetchGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
}));

describe('TableQueryRightPanel component test', () => {
  it('Component should render', async () => {
    render(<TableQueryRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByTestId('edit-owner-btn')).toBeInTheDocument();
  });
});
