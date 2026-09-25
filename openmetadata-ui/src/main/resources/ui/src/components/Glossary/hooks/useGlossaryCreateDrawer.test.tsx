/*
 *  Copyright 2026 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addGlossaries } from '../../../rest/glossaryAPI';
import { useGlossaryCreateDrawer } from './useGlossaryCreateDrawer';

const mockNavigate = jest.fn();
const mockOnCreated = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me' } }),
}));

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: () => ({
    activeDomainEntityRef: {
      id: 'domain-id',
      type: 'domain',
      name: 'Finance',
      fullyQualifiedName: 'Finance',
    },
  }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
      canAddMultipleDomains: true,
    },
  }),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  addGlossaries: jest.fn(),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

jest.mock('../../../rest/domainAPI', () => ({
  searchDomains: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn(({ onTextChange }: { onTextChange: (value: string) => void }) => (
    <textarea
      aria-label="description-editor"
      onChange={(event) => onTextChange(event.target.value)}
    />
  ))
);

jest.mock('../../Tag/TagSelector/TagSelector', () =>
  jest.fn(() => <div data-testid="tag-selector" />)
);

const Harness = () => {
  const { formDrawer, openDrawer } = useGlossaryCreateDrawer(mockOnCreated);

  return (
    <>
      <button onClick={openDrawer}>open</button>
      {formDrawer}
    </>
  );
};

const openAndFill = async () => {
  fireEvent.click(screen.getByText('open'));
  fireEvent.change(await screen.findByLabelText('label.name'), {
    target: { value: 'Business' },
  });
  fireEvent.change(screen.getByLabelText('description-editor'), {
    target: { value: 'Business terms' },
  });
  fireEvent.click(screen.getByTestId('save-glossary'));
};

describe('useGlossaryCreateDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens a 40vw drawer without the configure-glossary panel', async () => {
    render(<Harness />);

    expect(screen.queryByTestId('add-glossary-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('open'));

    const dialog = await screen.findByRole('dialog');

    // The panel is full-width, so capping it at 40vw makes it 40% of the screen.
    expect(dialog.parentElement).toHaveStyle({ maxWidth: '40vw' });
    expect(screen.getByTestId('add-glossary-form')).toBeInTheDocument();
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument();
  });

  it('creates the glossary in the active domain and navigates to it', async () => {
    (addGlossaries as jest.Mock).mockResolvedValue({
      fullyQualifiedName: 'Business',
    });
    render(<Harness />);

    await openAndFill();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());

    expect(addGlossaries).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Business',
        description: 'Business terms',
        owners: [{ id: 'me', type: 'user' }],
        domains: ['Finance'],
      })
    );
    expect(mockOnCreated).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/glossary/Business');

    await waitFor(() =>
      expect(screen.queryByTestId('add-glossary-form')).not.toBeInTheDocument()
    );
  });

  it('keeps the drawer open with an inline error for a duplicate name', async () => {
    (addGlossaries as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Entity already exists' } },
    });
    render(<Harness />);

    await openAndFill();

    expect(
      await screen.findByText('server.entity-already-exist')
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockOnCreated).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-glossary-form')).toBeInTheDocument();
  });
});
