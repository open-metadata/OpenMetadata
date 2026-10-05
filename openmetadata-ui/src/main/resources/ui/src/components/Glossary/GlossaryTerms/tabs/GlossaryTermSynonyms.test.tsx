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
import userEvent from '@testing-library/user-event';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import {
  MOCKED_GLOSSARY_TERMS,
  MOCK_PERMISSIONS,
} from '../../../../mocks/Glossary.mock';
import GlossaryTermSynonyms from './GlossaryTermSynonyms';

const [mockGlossaryTerm1, mockGlossaryTerm2] = MOCKED_GLOSSARY_TERMS;

const mockContext: {
  data: GlossaryTerm;
  onUpdate: jest.Mock;
  isVersionView: boolean;
  permissions: OperationPermission;
} = {
  data: mockGlossaryTerm1 as GlossaryTerm,
  onUpdate: jest.fn(),
  isVersionView: false,
  permissions: MOCK_PERMISSIONS,
};

jest.mock('../../../Customization/GenericProvider/GenericContext', () => ({
  ...jest.requireActual(
    '../../../Customization/GenericProvider/GenericContext'
  ),
  useGenericContext: jest.fn().mockImplementation(() => mockContext),
}));

describe('GlossaryTermSynonyms', () => {
  it('renders synonyms and edit button', () => {
    mockContext.data = mockGlossaryTerm2;
    const { getByTestId, getByText } = render(<GlossaryTermSynonyms />);
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymItem = getByText('accessory');
    const editBtn = getByTestId('edit-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymItem).toBeInTheDocument();
    expect(editBtn).toBeInTheDocument();
  });

  it('renders add button', () => {
    mockContext.data = mockGlossaryTerm1;
    const { getByTestId } = render(<GlossaryTermSynonyms />);
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymAddBtn = getByTestId('synonym-add-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymAddBtn).toBeInTheDocument();
  });

  it('should not render add button if no permission', async () => {
    mockContext.data = mockGlossaryTerm1;
    mockContext.permissions = { ...MOCK_PERMISSIONS, EditAll: false };
    const { getByTestId, queryByTestId, findByText } = render(
      <GlossaryTermSynonyms />
    );
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymAddBtn = queryByTestId('synonym-add-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymAddBtn).toBeNull();

    const noDataPlaceholder = await findByText(/--/i);

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('should not render edit button if no permission', () => {
    mockContext.data = mockGlossaryTerm2;
    mockContext.permissions = { ...MOCK_PERMISSIONS, EditAll: false };
    const { getByTestId, queryByTestId } = render(<GlossaryTermSynonyms />);
    const synonymsContainer = getByTestId('synonyms-container');
    const editBtn = queryByTestId('edit-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(editBtn).toBeNull();
  });

  describe('editing', () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const startEditing = async () => {
      mockContext.data = mockGlossaryTerm2;
      mockContext.permissions = MOCK_PERMISSIONS;
      mockContext.onUpdate.mockClear();
      render(<GlossaryTermSynonyms />);
      await user.click(screen.getByTestId('edit-button'));

      return screen.getByTestId('synonyms-input');
    };

    it('adds synonyms on Enter and comma and saves them', async () => {
      const input = await startEditing();

      await user.type(input, 'test{Enter}revenue,');

      expect(screen.getByText('message.unsaved-changes')).toBeInTheDocument();

      await user.click(screen.getByTestId('save-synonym-btn'));

      expect(mockContext.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          synonyms: ['accessory', 'test', 'revenue'],
        })
      );
    });

    it('rejects a case-insensitive duplicate and keeps the typed text', async () => {
      const input = await startEditing();

      await user.type(input, 'Accessory{Enter}');

      expect(input).toHaveValue('Accessory');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(
        screen.getByText('message.entity-is-already-a-synonym')
      ).toBeInTheDocument();
      expect(screen.getAllByTestId(/^remove-synonym-/)).toHaveLength(1);
    });

    it('removes the last synonym on Backspace in an empty input', async () => {
      const input = await startEditing();

      await user.type(input, '{Backspace}');
      await user.click(screen.getByTestId('save-synonym-btn'));

      expect(mockContext.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ synonyms: [] })
      );
    });

    it('restores saved synonyms on cancel', async () => {
      const input = await startEditing();

      await user.type(input, 'test{Enter}');
      await user.click(screen.getByTestId('cancel-synonym-btn'));

      expect(mockContext.onUpdate).not.toHaveBeenCalled();
      expect(screen.queryByTestId('test')).not.toBeInTheDocument();
      expect(screen.getByTestId('accessory')).toBeInTheDocument();
    });
  });

  it('collapses synonyms beyond six behind a show more toggle', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const synonyms = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
    mockContext.data = { ...mockGlossaryTerm2, synonyms };
    mockContext.permissions = MOCK_PERMISSIONS;
    render(<GlossaryTermSynonyms />);

    expect(screen.queryByTestId('s7')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('synonyms-show-more-btn'));

    expect(screen.getByTestId('s8')).toBeInTheDocument();
    expect(screen.getByTestId('synonyms-show-more-btn')).toHaveTextContent(
      'label.show-less'
    );

    await user.click(screen.getByTestId('synonyms-show-more-btn'));

    expect(screen.queryByTestId('s7')).not.toBeInTheDocument();
  });
});
