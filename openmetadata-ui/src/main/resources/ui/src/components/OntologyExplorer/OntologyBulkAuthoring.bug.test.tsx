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

jest.mock('react-i18next', () => jest.requireActual('react-i18next'));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MediaType } from '../../generated/api/data/ontologyBulkTemplate';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  getOntologyBulkTemplate,
  listOntologyBulkJobs,
  submitOntologyBulkOperation,
} from '../../rest/ontologyAPI';
import OntologyBulkAuthoring from './OntologyBulkAuthoring';

jest.mock('../../rest/ontologyAPI', () => ({
  cancelOntologyBulkJob: jest.fn(),
  getOntologyBulkTemplate: jest.fn(),
  listOntologyBulkJobs: jest.fn(),
  submitOntologyBulkOperation: jest.fn(),
}));
jest.mock('../../utils/Export/ExportUtils', () => ({
  downloadFile: jest.fn(),
}));
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const GLOSSARY: Glossary = {
  description: 'Business vocabulary',
  id: '831c26a6-e266-43d6-bca5-f116dcc31a46',
  name: 'Commerce',
  displayName: 'Commerce',
};

let i18n: ReturnType<typeof i18next.createInstance>;

const buildI18n = async () => {
  const instance = i18next.createInstance();

  await instance.use(initReactI18next).init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          label: {
            'dry-run': 'Dry run',
            preview: 'Preview',
            'create-draft': 'Create draft',
            'bulk-edit': 'Bulk edit',
            'term-plural': 'Terms',
            'change-set-name': 'Change set name',
            'display-name': 'Display name',
            'draft-description': 'Draft description',
            'field-required': '{{field}} is required',
          },
          message: { 'bulk-edit-entity-help': 'Bulk edit {{entity}}' },
        },
      },
      fr: {
        translation: {
          label: {
            'dry-run': 'Aperçu sécurisé',
            preview: 'Aperçu',
            'create-draft': 'Créer un brouillon',
            'bulk-edit': 'Édition en bloc',
            'term-plural': 'Termes',
            'change-set-name': 'Nom du changeset',
            'display-name': 'Nom affiché',
            'draft-description': 'Description du brouillon',
            'field-required': '{{field}} est requis',
          },
          message: { 'bulk-edit-entity-help': 'Édition en bloc de {{entity}}' },
        },
      },
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  return instance;
};

describe('OntologyBulkAuthoring language-change reset bug', () => {
  beforeAll(async () => {
    i18n = await buildI18n();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (listOntologyBulkJobs as jest.Mock).mockResolvedValue({ jobs: [] });
    (getOntologyBulkTemplate as jest.Mock).mockResolvedValue({
      csv: 'action,termId,name',
      fileName: 'ontology-bulk-template.csv',
      headers: ['action', 'termId', 'name'],
      maximumSynchronousRows: 500,
      mediaType: MediaType.TextCSV,
    });
    (submitOntologyBulkOperation as jest.Mock).mockResolvedValue({});
  });

  it('preserves the uploaded CSV when the UI language changes', async () => {
    const CSV = 'action,termId,name\nCREATE,abc,Customer';
    render(
      <I18nextProvider i18n={i18n}>
        <OntologyBulkAuthoring glossary={GLOSSARY} relationshipTypes={[]} />
      </I18nextProvider>
    );
    const csvInput = within(
      await screen.findByTestId('ontology-bulk-csv')
    ).getByRole('textbox');
    await act(async () => {
      fireEvent.change(csvInput, { target: { value: CSV } });
    });
    await waitFor(() => expect(csvInput).toHaveValue(CSV));

    await act(async () => {
      await i18n.changeLanguage('fr');
    });

    const csvAfter = within(screen.getByTestId('ontology-bulk-csv')).getByRole(
      'textbox'
    );

    expect(csvAfter).toHaveValue(CSV);

    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('preserves the dryRun toggle (false) when the UI language changes', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <OntologyBulkAuthoring glossary={GLOSSARY} relationshipTypes={[]} />
      </I18nextProvider>
    );
    const csvInput = within(
      await screen.findByTestId('ontology-bulk-csv')
    ).getByRole('textbox');
    await act(async () => {
      fireEvent.change(csvInput, {
        target: { value: 'action,termId,name\nCREATE,abc,Customer' },
      });
    });
    const dryRunCheckbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(dryRunCheckbox);
    });
    await waitFor(() =>
      expect(screen.getByTestId('ontology-bulk-submit')).toHaveTextContent(
        'Create draft'
      )
    );

    await act(async () => {
      await i18n.changeLanguage('fr');
    });

    expect(screen.getByTestId('ontology-bulk-submit')).toHaveTextContent(
      'Créer un brouillon'
    );
    expect(screen.getByTestId('ontology-bulk-submit')).not.toHaveTextContent(
      'Aperçu'
    );

    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('still resets the templated metadata fields when the glossary changes', async () => {
    const NEXT: Glossary = {
      description: 'Sales vocabulary',
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Sales',
      displayName: 'Sales',
    };
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <OntologyBulkAuthoring glossary={GLOSSARY} relationshipTypes={[]} />
      </I18nextProvider>
    );
    await screen.findByTestId('ontology-bulk-authoring');

    rerender(
      <I18nextProvider i18n={i18n}>
        <OntologyBulkAuthoring glossary={NEXT} relationshipTypes={[]} />
      </I18nextProvider>
    );

    const changeSetNameInput = await screen.findByDisplayValue(
      'ontology-bulk-Sales'
    );

    expect(changeSetNameInput).toBeInTheDocument();
  });

  it('does not re-fire the reset effect on a no-op re-render with a fresh t reference', async () => {
    const CSV = 'action,termId,name\nCREATE,abc,Customer';
    render(
      <I18nextProvider i18n={i18n}>
        <OntologyBulkAuthoring glossary={GLOSSARY} relationshipTypes={[]} />
      </I18nextProvider>
    );
    const csvInput = within(
      await screen.findByTestId('ontology-bulk-csv')
    ).getByRole('textbox');
    await act(async () => {
      fireEvent.change(csvInput, { target: { value: CSV } });
    });
    await waitFor(() => expect(csvInput).toHaveValue(CSV));

    await act(async () => {
      await i18n.changeLanguage('fr');
    });
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const csvAfter = within(screen.getByTestId('ontology-bulk-csv')).getByRole(
      'textbox'
    );

    expect(csvAfter).toHaveValue(CSV);
  });
});
