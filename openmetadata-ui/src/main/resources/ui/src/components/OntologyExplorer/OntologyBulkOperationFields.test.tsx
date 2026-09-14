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

import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  MatchField,
  MatchMode,
  Operation,
} from '../../generated/api/data/ontologyBulkRequest';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { OntologyBulkFormState } from './OntologyBulkAuthoring.utils';
import OntologyBulkOperationFields from './OntologyBulkOperationFields';

interface MockSelectProps {
  items: Array<{ id: string; label: string }>;
  label: string;
  value?: string;
  onChange: (key: string) => void;
  'data-testid'?: string;
}

interface MockTextProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  'data-testid'?: string;
}

interface MockCheckboxProps {
  label: string;
  isSelected?: boolean;
  onChange: (isSelected: boolean) => void;
}

interface MockButtonProps {
  children: ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
  'data-testid'?: string;
}

interface MockFileTriggerProps {
  children: ReactNode;
  onSelect: (files: FileList | null) => void;
  'data-testid'?: string;
}

jest.mock('@untitledui/icons', () => ({
  Download01: () => null,
  UploadCloud01: () => null,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const MockSelect = ({
    items,
    label,
    value,
    onChange,
    'data-testid': testId,
  }: MockSelectProps) => (
    <select
      aria-label={label}
      data-testid={testId}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
  MockSelect.Item = () => null;

  const MockText = ({
    label,
    value,
    onChange,
    'data-testid': testId,
  }: MockTextProps) => (
    <input
      aria-label={label}
      data-testid={testId}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  return {
    Button: ({
      children,
      isLoading,
      onClick,
      'data-testid': testId,
    }: MockButtonProps) => (
      <button
        data-loading={String(Boolean(isLoading))}
        data-testid={testId}
        type="button"
        onClick={onClick}>
        {children}
      </button>
    ),
    Checkbox: ({ label, isSelected, onChange }: MockCheckboxProps) => (
      <input
        aria-label={label}
        checked={Boolean(isSelected)}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    ),
    FileTrigger: ({
      children,
      onSelect,
      'data-testid': testId,
    }: MockFileTriggerProps) => (
      <>
        <input
          aria-label="file"
          data-testid={testId}
          type="file"
          onChange={(event) => onSelect(event.target.files)}
        />
        {children}
      </>
    ),
    Input: MockText,
    Select: MockSelect,
    TextArea: MockText,
  };
});

const RELATIONSHIP_TYPES: RelationshipType[] = [
  { id: 'rt-1', name: 'relatedTo', displayName: 'Related to' },
  { id: 'rt-2', name: 'partOf' },
] as RelationshipType[];

const FORM: OntologyBulkFormState = {
  caseSensitive: false,
  changeSetDescription: '',
  changeSetDisplayName: '',
  changeSetName: '',
  csv: 'a,b',
  dryRun: true,
  field: MatchField.Name,
  find: 'old',
  fromRelationshipTypeId: 'rt-1',
  matchMode: MatchMode.Exact,
  operation: Operation.CSVUpsert,
  replacement: 'new',
  termIds: '',
  toRelationshipTypeId: 'rt-2',
};

const renderFields = (
  overrides: Partial<OntologyBulkFormState> = {},
  isDownloadingTemplate = false
) => {
  const onDownloadTemplate = jest.fn();
  const onFileSelect = jest.fn();
  const onUpdate = jest.fn();
  render(
    <OntologyBulkOperationFields
      form={{ ...FORM, ...overrides }}
      isDownloadingTemplate={isDownloadingTemplate}
      relationshipTypes={RELATIONSHIP_TYPES}
      onDownloadTemplate={onDownloadTemplate}
      onFileSelect={onFileSelect}
      onUpdate={onUpdate}
    />
  );

  return { onDownloadTemplate, onFileSelect, onUpdate };
};

describe('OntologyBulkOperationFields', () => {
  it('switches operation through the operation select', () => {
    const { onUpdate } = renderFields();

    fireEvent.change(screen.getByTestId('ontology-bulk-operation'), {
      target: { value: Operation.FindReplace },
    });

    expect(onUpdate).toHaveBeenCalledWith('operation', Operation.FindReplace);
  });

  it('renders csv upload controls for the csv operation', () => {
    const { onDownloadTemplate, onFileSelect, onUpdate } = renderFields(
      {},
      true
    );

    expect(
      screen.getByTestId('ontology-bulk-download-template')
    ).toHaveAttribute('data-loading', 'true');
    expect(screen.queryByTestId('ontology-bulk-find')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-bulk-download-template'));
    fireEvent.change(screen.getByTestId('ontology-bulk-csv'), {
      target: { value: 'x,y' },
    });
    const file = new File(['a,b'], 'terms.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByTestId('ontology-bulk-file-input'), {
      target: { files: [file] },
    });

    expect(onDownloadTemplate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('csv', 'x,y');
    expect(onFileSelect).toHaveBeenCalledTimes(1);
    expect(onFileSelect.mock.calls[0][0][0]).toBe(file);
  });

  it('renders find and replace fields and forwards every change', () => {
    const { onUpdate } = renderFields({ operation: Operation.FindReplace });

    expect(screen.queryByTestId('ontology-bulk-csv')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('label.field'), {
      target: { value: MatchField.Description },
    });
    fireEvent.change(screen.getByLabelText('label.match-type'), {
      target: { value: MatchMode.Contains },
    });
    fireEvent.change(screen.getByTestId('ontology-bulk-find'), {
      target: { value: 'needle' },
    });
    fireEvent.change(screen.getByTestId('ontology-bulk-replacement'), {
      target: { value: 'thread' },
    });
    fireEvent.click(screen.getByLabelText('label.sensitive'));

    expect(onUpdate).toHaveBeenCalledWith('field', MatchField.Description);
    expect(onUpdate).toHaveBeenCalledWith('matchMode', MatchMode.Contains);
    expect(onUpdate).toHaveBeenCalledWith('find', 'needle');
    expect(onUpdate).toHaveBeenCalledWith('replacement', 'thread');
    expect(onUpdate).toHaveBeenCalledWith('caseSensitive', true);
  });

  it('renders relationship retype fields using display names with a name fallback', () => {
    const { onUpdate } = renderFields({
      operation: Operation.RetypeRelationships,
    });

    const fromSelect = screen.getByLabelText(
      'label.relationship-type label.from-lowercase'
    );

    expect(fromSelect).toHaveValue('rt-1');
    expect(screen.getAllByRole('option', { name: 'Related to' })).toHaveLength(
      2
    );
    expect(screen.getAllByRole('option', { name: 'partOf' })).toHaveLength(2);

    fireEvent.change(fromSelect, { target: { value: 'rt-2' } });
    fireEvent.change(
      screen.getByLabelText('label.relationship-type label.to-lowercase'),
      { target: { value: 'rt-1' } }
    );
    fireEvent.change(
      screen.getByLabelText('label.term-plural (label.optional)'),
      { target: { value: 'id-1,id-2' } }
    );

    expect(onUpdate).toHaveBeenCalledWith('fromRelationshipTypeId', 'rt-2');
    expect(onUpdate).toHaveBeenCalledWith('toRelationshipTypeId', 'rt-1');
    expect(onUpdate).toHaveBeenCalledWith('termIds', 'id-1,id-2');
  });
});
