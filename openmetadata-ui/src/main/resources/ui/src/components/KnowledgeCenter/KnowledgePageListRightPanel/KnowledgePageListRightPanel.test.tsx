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
import {
    act,
    fireEvent,
    render,
    screen,
    waitForElementToBeRemoved,
} from '@testing-library/react';

import { OperationPermission } from 'context/PermissionProvider/PermissionProvider.interface';
import { MemoryRouter } from 'react-router-dom';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import { getTags } from '../../../rest/tagAPI';
import KnowledgePageListRightPanel, {
    KnowledgePageListRightPanelProps,
} from './KnowledgePageListRightPanel';
import {
    MOCK_KNOWLEDGE_CENTER_TAG,
    QUICK_LINK_MOCK_DATA,
} from './KnowledgePageListRightPanel.mock';

const mockAdd = jest.fn();

const mockPermissions = {
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
} as OperationPermission;

jest.mock('../../../rest/knowledgeCenterAPI', () => ({
  getListKnowledgePages: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
}));
jest.mock('rest/tagAPI', () => ({
  getTags: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: [MOCK_KNOWLEDGE_CENTER_TAG] })
    ),
}));

jest.mock('../BookMarkWidget/BookMarkWidget', () =>
  jest.fn().mockReturnValue(<div>BookMark Widget</div>)
);

jest.mock('../../../utils/KnowledgePageUtils', () => ({
  ...jest.requireActual('../../../utils/KnowledgePageUtils'),
  getKnowledgeCenterRecentViewed: jest.fn().mockImplementation(() => []),
}));

const mockProps: KnowledgePageListRightPanelProps = {
  onAdd: mockAdd,
  permissions: mockPermissions,
  refreshBookMarkWidget: false,
  onRefreshBookMarkWidget: jest.fn(),
  refreshTagsCategory: false,
  onRefreshTagsCategory: jest.fn(),
};

describe('KnowledgePageListRightPanel', () => {
  it('Should render the error placeholder if no data', async () => {
    (getTags as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [] })
    );

    render(<KnowledgePageListRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByTestId('create-error-placeholder-label.quick-link-plural')
    ).toBeInTheDocument();

    const addQuickLinkBtn = screen.getByTestId('add-quick-link');

    expect(addQuickLinkBtn).toBeInTheDocument();

    // add button should call the onAdd callback

    fireEvent.click(addQuickLinkBtn);

    expect(mockAdd).toHaveBeenCalled();
  });

  it('Should render the no recent view placeholder if no recently viewed data', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [QUICK_LINK_MOCK_DATA] })
    );

    render(<KnowledgePageListRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByText('message.no-recently-viewed-data')
    ).toBeInTheDocument();
  });

  it('Should render the recently viewed data', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [
          { ...QUICK_LINK_MOCK_DATA, fullyQualifiedName: 'QuickLink_Testing' },
        ],
      })
    );

    await act(async () => {
      render(<KnowledgePageListRightPanel {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      screen.getByTestId(
        `tag-category-KnowledgeCenter.application-customization-${QUICK_LINK_MOCK_DATA.displayName}`
      )
    ).toBeInTheDocument();
  });
});
