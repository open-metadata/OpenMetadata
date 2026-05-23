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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { searchGlossaryTermsPaginated } from '../../../../rest/glossaryAPI';
import { TermsRowEditorProps } from './RelatedTerms.interface';
import TermsRowEditor from './TermsRowEditor.component';

jest.mock('../../../../rest/glossaryAPI', () => ({
  searchGlossaryTermsPaginated: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const React = require('react');

  return {
    Autocomplete: Object.assign(
      ({
        children,
        items,
        onSearchChange,
      }: {
        children: (item: { id: string; label: string }) => React.ReactNode;
        items: Array<{ id: string; label: string }>;
        onSearchChange?: (v: string) => void;
      }) =>
        React.createElement(
          'div',
          { 'data-testid': 'autocomplete' },
          React.createElement('input', {
            'data-testid': 'autocomplete-input',
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              onSearchChange?.(e.target.value),
          }),
          (items ?? []).map((item) => children(item))
        ),
      {
        Item: ({ label, id }: { label: string; id: string }) =>
          React.createElement('div', { 'data-testid': `option-${id}` }, label),
      }
    ),
    Button: ({
      children,
      iconLeading: _iconLeading,
      onClick,
      ...props
    }: Record<string, unknown>) =>
      React.createElement('button', { ...props, onClick }, children),
    Select: Object.assign(
      ({
        children,
        items,
        onChange,
        value,
        ...props
      }: {
        children: (item: { id: string; label?: string }) => React.ReactNode;
        items: Array<{ id: string; label?: string }>;
        onChange?: (key: string) => void;
        value?: string;
        [key: string]: unknown;
      }) =>
        React.createElement(
          'select',
          {
            ...props,
            value,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              onChange?.(e.target.value),
          },
          (items ?? []).map((item) => children(item))
        ),
      {
        Item: ({ label, id }: { label?: string; id: string }) =>
          React.createElement('option', { value: id }, label),
      }
    ),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts?.entity) {
        return `${key} ${opts.entity}`;
      }

      return key;
    },
  }),
}));

const editorProps: TermsRowEditorProps = {
  rows: [
    { id: 'row-1', relationType: 'relatedTo', terms: [] },
    { id: 'row-2', relationType: 'synonymOf', terms: [] },
  ],
  excludeFQN: 'Glossary.CurrentTerm',
  preloadedTerms: [],
  relationTypeOptions: [
    { id: 'relatedTo', label: 'Related To' },
    { id: 'synonymOf', label: 'Synonym Of' },
  ],
  onAddRow: jest.fn(),
  onRelationTypeChange: jest.fn(),
  onTermsChange: jest.fn(),
  onRemove: jest.fn(),
};

describe('TermsRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the row with the given rowId', () => {
    render(
      <TermsRowEditor
        {...editorProps}
        rows={[{ id: 'row-1', relationType: 'relatedTo', terms: [] }]}
      />
    );

    expect(screen.getByTestId('relation-row-row-1')).toBeInTheDocument();
  });

  it('renders the autocomplete for terms', () => {
    render(
      <TermsRowEditor
        {...editorProps}
        rows={[{ id: 'row-1', relationType: 'relatedTo', terms: [] }]}
      />
    );

    expect(screen.getByTestId('term-autocomplete-row-1')).toBeInTheDocument();
  });

  it('renders the remove button', () => {
    render(
      <TermsRowEditor
        {...editorProps}
        rows={[{ id: 'row-1', relationType: 'relatedTo', terms: [] }]}
      />
    );

    expect(screen.getByTestId('remove-row-row-1')).toBeInTheDocument();
  });

  it('calls onRemove with the rowId when remove button is clicked', () => {
    render(
      <TermsRowEditor
        {...editorProps}
        rows={[{ id: 'row-1', relationType: 'relatedTo', terms: [] }]}
      />
    );

    fireEvent.click(screen.getByTestId('remove-row-row-1'));

    expect(editorProps.onRemove).toHaveBeenCalledWith('row-1');
  });

  it('calls onRelationTypeChange when relation type select changes', () => {
    render(
      <TermsRowEditor
        {...editorProps}
        rows={[{ id: 'row-1', relationType: 'relatedTo', terms: [] }]}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'synonymOf' },
    });

    expect(editorProps.onRelationTypeChange).toHaveBeenCalledWith(
      'row-1',
      'synonymOf'
    );
  });

  it('excludes the excludeFQN term from dropdown options', () => {
    render(
      <TermsRowEditor
        {...editorProps}
        preloadedTerms={[
          {
            id: 'term-1',
            name: 'CurrentTerm',
            fullyQualifiedName: 'Glossary.CurrentTerm',
          } as GlossaryTerm,
          {
            id: 'term-2',
            name: 'OtherTerm',
            fullyQualifiedName: 'Glossary.OtherTerm',
          } as GlossaryTerm,
        ]}
        rows={[{ id: 'row-1', relationType: 'relatedTo', terms: [] }]}
      />
    );

    expect(screen.queryByTestId('option-Glossary.CurrentTerm')).toBeNull();
    expect(screen.getByTestId('option-Glossary.OtherTerm')).toBeInTheDocument();
  });

  it('searches for terms when typing in the autocomplete', async () => {
    (searchGlossaryTermsPaginated as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          id: 'term-3',
          name: 'SearchResult',
          fullyQualifiedName: 'Glossary.SearchResult',
        },
      ],
    });

    render(
      <TermsRowEditor
        {...editorProps}
        rows={[{ id: 'row-1', relationType: 'relatedTo', terms: [] }]}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByTestId('autocomplete-input'), {
        target: { value: 'Search' },
      });
    });

    await waitFor(
      () => {
        expect(searchGlossaryTermsPaginated).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'Search' })
        );
      },
      { timeout: 500 }
    );
  });

  it('clears searched terms when autocomplete input is emptied', async () => {
    render(
      <TermsRowEditor
        {...editorProps}
        rows={[{ id: 'row-1', relationType: 'relatedTo', terms: [] }]}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByTestId('autocomplete-input'), {
        target: { value: '' },
      });
    });

    expect(searchGlossaryTermsPaginated).not.toHaveBeenCalled();
  });
});

describe('TermsRowEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all rows', () => {
    render(<TermsRowEditor {...editorProps} />);

    expect(screen.getByTestId('relation-row-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('relation-row-row-2')).toBeInTheDocument();
  });

  it('renders the add row button', () => {
    render(<TermsRowEditor {...editorProps} />);

    expect(screen.getByTestId('add-row-button')).toBeInTheDocument();
  });

  it('calls onAddRow when the add button is clicked', () => {
    render(<TermsRowEditor {...editorProps} />);

    fireEvent.click(screen.getByTestId('add-row-button'));

    expect(editorProps.onAddRow).toHaveBeenCalledTimes(1);
  });

  it('renders with no rows when rows array is empty', () => {
    render(<TermsRowEditor {...editorProps} rows={[]} />);

    expect(screen.queryByTestId('relation-row-row-1')).toBeNull();
    expect(screen.getByTestId('add-row-button')).toBeInTheDocument();
  });
});
