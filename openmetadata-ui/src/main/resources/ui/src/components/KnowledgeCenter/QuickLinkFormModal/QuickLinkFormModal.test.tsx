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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OperationPermission } from 'context/PermissionProvider/PermissionProvider.interface';
import {
  QuickLinkFormModal,
  QuickLinkFormModalProps,
} from './QuickLinkFormModal';

jest.mock(
  'components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () => jest.fn(() => <div data-testid="data-asset-async-select-list" />)
);

const mockSave = jest.fn();

const mockCancel = jest.fn();

jest.mock('utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation((entity) => entity.displayName),
}));
jest.mock('utils/TableUtils', () => ({
  getTagsWithoutTier: jest.fn(),
}));

jest.mock('utils/TableTags/TableTags.utils', () => ({
  getFilterTags: jest.fn(),
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('pages/TasksPage/shared/DescriptionTask');
jest.mock('pages/TasksPage/shared/DescriptionTaskNew');

const mockProps: QuickLinkFormModalProps = {
  isOpen: true,
  onSave: mockSave,
  onCancel: mockCancel,
  permissions: {
    EditAll: true,
    EditDisplayName: true,
    EditDescription: true,
    EditTags: true,
  } as OperationPermission,
};

describe('QuickLinkFormModal', () => {
  it('Should render the form inputs', async () => {
    render(<QuickLinkFormModal {...mockProps} />);

    const displayNameInput = screen.getByTestId('displayName');
    const urlInput = screen.getByTestId('url');
    const descriptionEditor = screen.getByTestId('editor');
    const tagSelectors = screen.getAllByTestId('tag-selector');

    expect(displayNameInput).toBeInTheDocument();
    expect(urlInput).toBeInTheDocument();
    expect(descriptionEditor).toBeInTheDocument();
    expect(tagSelectors).toHaveLength(2);
    expect(
      screen.getByTestId('data-asset-async-select-list')
    ).toBeInTheDocument();
  });

  it('onSave should work', async () => {
    render(<QuickLinkFormModal {...mockProps} />);

    const displayNameInput = screen.getByTestId('displayName');
    const urlInput = screen.getByTestId('url');

    fireEvent.change(displayNameInput, { target: { value: 'displayName' } });
    fireEvent.change(urlInput, { target: { value: 'https://example.coms' } });

    const submitBtn = screen.getByText('label.save');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockSave).toHaveBeenCalledWith({
      description: '',
      displayName: 'displayName',
      glossaryTerms: undefined,
      relatedEntities: [],
      tags: undefined,
      url: 'https://example.coms',
    });
  });

  it('onCancel should work', async () => {
    render(<QuickLinkFormModal {...mockProps} />);

    const cancelBtn = screen.getByText('label.back');

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(mockCancel).toHaveBeenCalled();
  });
});
