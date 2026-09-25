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
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { getGlossaryTermByFQN } from '../../../rest/glossaryAPI';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import GlossaryTermDrawer from './GlossaryTermDrawer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'me' } }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  }),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermByFQN: jest.fn(),
}));

jest.mock('../../../rest/intakeFormsAPI', () => ({
  getIntakeFormByEntityType: jest.fn(),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn(),
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

jest.mock(
  '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider',
  () => ({
    EntityAttachmentProvider: ({ children }: { children: JSX.Element }) =>
      children,
  })
);

jest.mock('../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn(
    ({
      initialValue,
      onTextChange,
    }: {
      initialValue?: string;
      onTextChange: (value: string) => void;
    }) => (
      <textarea
        aria-label="description-editor"
        defaultValue={initialValue}
        onChange={(event) => onTextChange(event.target.value)}
      />
    )
  )
);

jest.mock('../../Tag/TagSelector/TagSelector', () =>
  jest.fn(() => <div data-testid="tag-selector" />)
);

jest.mock('../../common/GlossaryTermPicker/GlossaryTermPicker', () =>
  jest.fn(() => <div data-testid="related-terms" />)
);

const TERM = {
  id: 'term-id',
  name: 'Revenue',
  description: 'Money in',
  fullyQualifiedName: 'Business.Revenue',
  glossary: { id: 'g1', type: 'glossary' },
  owners: [{ id: 'owner-id', type: 'user', name: 'owner' }],
  relatedTerms: [
    {
      term: {
        id: 'related-id',
        type: 'glossaryTerm',
        fullyQualifiedName: 'Business.Profit',
      },
    },
  ],
} as GlossaryTerm;

const onSave = jest.fn();
const onCancel = jest.fn();

describe('GlossaryTermDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onSave.mockResolvedValue(undefined);
    (getIntakeFormByEntityType as jest.Mock).mockResolvedValue(null);
    (getCustomPropertiesByEntityType as jest.Mock).mockResolvedValue([]);
    (getGlossaryTermByFQN as jest.Mock).mockResolvedValue(TERM);
  });

  it('creates a term with the current user as the default owner', async () => {
    render(
      <GlossaryTermDrawer
        editMode={false}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    expect(await screen.findByText('label.add-entity')).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText('label.name'), {
      target: { value: 'Revenue' },
    });
    fireEvent.change(screen.getByLabelText('description-editor'), {
      target: { value: 'Money in' },
    });
    fireEvent.click(screen.getByTestId('save-glossary-term'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    expect(onSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: 'Revenue',
        description: 'Money in',
        owners: [{ id: 'me', type: 'user' }],
        relatedTerms: [],
      })
    );
    expect(getGlossaryTermByFQN).not.toHaveBeenCalled();
  });

  it('loads the term in edit mode and saves related terms as ids', async () => {
    render(
      <GlossaryTermDrawer
        editMode
        glossaryTermFQN="Business.Revenue"
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    expect(await screen.findByLabelText('label.name')).toHaveValue('Revenue');
    expect(screen.getByText('label.edit-entity')).toBeInTheDocument();
    expect(getIntakeFormByEntityType).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('save-glossary-term'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    expect(onSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: 'Revenue',
        description: 'Money in',
        owners: [TERM.owners?.[0]],
        relatedTerms: ['related-id'],
      })
    );
  });

  it('closes instead of editing a term that failed to load', async () => {
    (getGlossaryTermByFQN as jest.Mock).mockRejectedValue(new Error('boom'));

    render(
      <GlossaryTermDrawer
        editMode
        glossaryTermFQN="Business.Revenue"
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    await waitFor(() => expect(onCancel).toHaveBeenCalled());

    expect(showErrorToast).toHaveBeenCalled();
  });

  it('shows a duplicate-name rejection on the name field', async () => {
    onSave.mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'Entity with name Revenue already exists' },
      },
    });

    render(
      <GlossaryTermDrawer
        editMode={false}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    fireEvent.change(await screen.findByLabelText('label.name'), {
      target: { value: 'Revenue' },
    });
    fireEvent.change(screen.getByLabelText('description-editor'), {
      target: { value: 'Money in' },
    });
    fireEvent.click(screen.getByTestId('save-glossary-term'));

    expect(
      await screen.findByText('Entity with name Revenue already exists')
    ).toBeInTheDocument();
    expect(showErrorToast).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('reports cancel to the parent', async () => {
    render(
      <GlossaryTermDrawer
        editMode={false}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    fireEvent.click(await screen.findByTestId('cancel-glossary-term'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
