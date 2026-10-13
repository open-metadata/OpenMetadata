/*
 *  Copyright 2024 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import { TagSource } from '../../../../generated/entity/data/container';
import { GlossaryPickerValue } from '../../../common/GlossaryTermPicker/GlossaryTagSuggestionUtils';
import { TermsRowEditorProps } from './RelatedTerms.interface';
import TermsRowEditor from './TermsRowEditor.component';

const mockPicker = jest.fn();

jest.mock('../../../common/GlossaryTermPicker/GlossaryTermPicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPicker(props);

    return (
      <button
        aria-label="glossary term picker"
        data-testid={props['data-testid'] as string}
        onClick={() => {
          const picked = [
            {
              tagFQN: 'Glossary.OtherTerm',
              name: 'OtherTerm',
              source: TagSource.Glossary,
            } as GlossaryPickerValue,
          ];
          // The row reads the second argument, which keeps the source entity.
          (
            props.onChange as (
              terms: GlossaryPickerValue[],
              nodes: GlossaryPickerValue[]
            ) => void
          )(picked, picked);
        }}
      />
    );
  },
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const React = require('react');

  return {
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
  relationTypeOptions: [
    { id: 'relatedTo', label: 'Related To' },
    { id: 'synonymOf', label: 'Synonym Of' },
  ],
  onAddRow: jest.fn(),
  onRelationTypeChange: jest.fn(),
  onTermsChange: jest.fn(),
  onRemove: jest.fn(),
};

const singleRow = [{ id: 'row-1', relationType: 'relatedTo', terms: [] }];

describe('TermsRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the row with the given rowId', () => {
    render(<TermsRowEditor {...editorProps} rows={singleRow} />);

    expect(screen.getByTestId('relation-row-row-1')).toBeInTheDocument();
  });

  it('renders the term picker for the row', () => {
    render(<TermsRowEditor {...editorProps} rows={singleRow} />);

    expect(screen.getByTestId('term-picker-row-1')).toBeInTheDocument();
  });

  it('excludes the current term from the picker', () => {
    render(<TermsRowEditor {...editorProps} rows={singleRow} />);

    expect(mockPicker).toHaveBeenCalledWith(
      expect.objectContaining({ excludeFqns: ['Glossary.CurrentTerm'] })
    );
  });

  it('reports picked terms as term items', () => {
    render(<TermsRowEditor {...editorProps} rows={singleRow} />);

    fireEvent.click(screen.getByTestId('term-picker-row-1'));

    expect(editorProps.onTermsChange).toHaveBeenCalledWith('row-1', [
      expect.objectContaining({
        value: 'Glossary.OtherTerm',
        label: 'OtherTerm',
      }),
    ]);
  });

  it('seeds the picker with the terms the row already holds', () => {
    render(
      <TermsRowEditor
        {...editorProps}
        rows={[
          {
            id: 'row-1',
            relationType: 'relatedTo',
            terms: [{ value: 'Glossary.Seeded', label: 'Seeded' }],
          },
        ]}
      />
    );

    expect(mockPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        value: [expect.objectContaining({ tagFQN: 'Glossary.Seeded' })],
      })
    );
  });

  it('renders the remove button', () => {
    render(<TermsRowEditor {...editorProps} rows={singleRow} />);

    expect(screen.getByTestId('remove-row-row-1')).toBeInTheDocument();
  });

  it('calls onRemove with the rowId when remove button is clicked', () => {
    render(<TermsRowEditor {...editorProps} rows={singleRow} />);

    fireEvent.click(screen.getByTestId('remove-row-row-1'));

    expect(editorProps.onRemove).toHaveBeenCalledWith('row-1');
  });

  it('calls onRelationTypeChange when relation type select changes', () => {
    render(<TermsRowEditor {...editorProps} rows={singleRow} />);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'synonymOf' },
    });

    expect(editorProps.onRelationTypeChange).toHaveBeenCalledWith(
      'row-1',
      'synonymOf'
    );
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
