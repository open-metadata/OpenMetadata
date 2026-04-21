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
import {
  FieldErrorProps,
  RJSFSchema,
  TemplatesType,
  WidgetProps,
} from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import ManifestJsonWidget, { validateManifestJson } from './ManifestJsonWidget';

// Mock the SchemaEditor so the widget can be rendered without the
// heavy CodeMirror dependency. We surface the props we care about as
// data-* attributes so tests can assert the editor is wired up with
// JSON-aware syntax highlighting (regression guard).
const mockSchemaEditor = jest
  .fn()
  .mockImplementation(
    ({
      value,
      mode,
      readOnly,
    }: {
      value: string;
      mode?: { name?: string; json?: boolean };
      readOnly?: boolean;
    }) => (
      <div
        data-mode-json={String(Boolean(mode?.json))}
        data-mode-name={mode?.name}
        data-readonly={String(Boolean(readOnly))}
        data-testid="schema-editor">
        {value || '<empty>'}
      </div>
    )
  );

jest.mock('../../../../../Database/SchemaEditor/SchemaEditor', () => ({
  __esModule: true,
  default: (props: unknown) => mockSchemaEditor(props),
}));

const baseProps: Partial<WidgetProps> = {
  id: 'defaultManifest',
  onChange: jest.fn(),
  onFocus: jest.fn(),
  onBlur: jest.fn(),
  name: 'defaultManifest',
  label: 'Default Manifest',
  schema: {},
  disabled: false,
  options: {} as Partial<
    Omit<TemplatesType<unknown, RJSFSchema, unknown>, 'ButtonTemplates'>
  >,
  registry: {} as FieldErrorProps['registry'],
};

const makeProps = (overrides: Partial<WidgetProps>): WidgetProps =>
  ({ ...baseProps, ...overrides } as WidgetProps);

// ----------------------------------------------------------------------
// validateManifestJson
// ----------------------------------------------------------------------

describe('validateManifestJson', () => {
  it('returns empty for blank input', () => {
    expect(validateManifestJson('').status).toBe('empty');
    expect(validateManifestJson('   \n\t  ').status).toBe('empty');
  });

  it('reports JSON syntax errors', () => {
    const result = validateManifestJson('{ not valid');

    expect(result.status).toBe('error');

    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-json');
    }
  });

  it('rejects non-object top-level values', () => {
    const array = validateManifestJson('[1,2,3]');
    const scalar = validateManifestJson('"hello"');

    expect(array.status).toBe('error');
    expect(scalar.status).toBe('error');

    if (array.status === 'error') {
      expect(array.error.code).toBe('top-level-must-be-object');
    }
    if (scalar.status === 'error') {
      expect(scalar.error.code).toBe('top-level-must-be-object');
    }
  });

  it('rejects unknown top-level fields', () => {
    const result = validateManifestJson(JSON.stringify({ entrys: [] }));

    expect(result.status).toBe('error');

    if (
      result.status === 'error' &&
      result.error.code === 'unknown-top-level-field'
    ) {
      expect(result.error.field).toBe('entrys');
    }
  });

  it('requires entries to be an array', () => {
    const result = validateManifestJson(
      JSON.stringify({ entries: 'not-an-array' })
    );

    expect(result.status).toBe('error');

    if (result.status === 'error') {
      expect(result.error.code).toBe('entries-must-be-array');
    }
  });

  it('requires containerName on each entry', () => {
    const result = validateManifestJson(
      JSON.stringify({
        entries: [{ dataPath: 'x' }],
      })
    );

    expect(result.status).toBe('error');

    if (
      result.status === 'error' &&
      result.error.code === 'entry-required-field'
    ) {
      expect(result.error.field).toBe('containerName');
      expect(result.error.index).toBe(1);
    }
  });

  it('requires dataPath on each entry', () => {
    const result = validateManifestJson(
      JSON.stringify({
        entries: [{ containerName: 'b' }],
      })
    );

    expect(result.status).toBe('error');

    if (
      result.status === 'error' &&
      result.error.code === 'entry-required-field'
    ) {
      expect(result.error.field).toBe('dataPath');
    }
  });

  it('flags unknown entry fields with suggestion for obvious typos', () => {
    const result = validateManifestJson(
      JSON.stringify({
        entries: [
          {
            containerName: 'b',
            dataPath: 'x',
            structuredFormat: 'parquet', // typo
          },
        ],
      })
    );

    expect(result.status).toBe('error');

    if (
      result.status === 'error' &&
      result.error.code === 'entry-unknown-field'
    ) {
      expect(result.error.field).toBe('structuredFormat');
      expect(result.error.suggestion).toBe('structureFormat');
    }
  });

  it('rejects wrong types on known fields', () => {
    const result = validateManifestJson(
      JSON.stringify({
        entries: [
          {
            containerName: 'b',
            dataPath: 'x',
            autoPartitionDetection: 'yes', // should be boolean
          },
        ],
      })
    );

    expect(result.status).toBe('error');

    if (result.status === 'error' && result.error.code === 'entry-type-error') {
      expect(result.error.field).toBe('autoPartitionDetection');
      expect(result.error.mismatch.kind).toBe('expected-boolean');
    }
  });

  it('rejects array fields whose elements are not strings', () => {
    const result = validateManifestJson(
      JSON.stringify({
        entries: [
          {
            containerName: 'b',
            dataPath: 'x',
            excludePaths: [1, 2, 3],
          },
        ],
      })
    );

    expect(result.status).toBe('error');

    if (result.status === 'error' && result.error.code === 'entry-type-error') {
      expect(result.error.field).toBe('excludePaths');
      expect(result.error.mismatch.kind).toBe('expected-string-array');
    }
  });

  it('validates partitionColumns shape', () => {
    const missingName = validateManifestJson(
      JSON.stringify({
        entries: [
          {
            containerName: 'b',
            dataPath: 'x',
            partitionColumns: [{ dataType: 'INT' }],
          },
        ],
      })
    );

    expect(missingName.status).toBe('error');

    if (
      missingName.status === 'error' &&
      missingName.error.code === 'partition-column-required'
    ) {
      expect(missingName.error.field).toBe('name');
    }

    const typoField = validateManifestJson(
      JSON.stringify({
        entries: [
          {
            containerName: 'b',
            dataPath: 'x',
            partitionColumns: [
              { name: 'year', dataType: 'INT', datatype: 'INT' },
            ],
          },
        ],
      })
    );

    expect(typoField.status).toBe('error');

    if (
      typoField.status === 'error' &&
      typoField.error.code === 'partition-column-unknown-field'
    ) {
      expect(typoField.error.field).toBe('datatype');
      expect(typoField.error.suggestion).toBe('dataType');
    }
  });

  it('accepts a minimal valid manifest', () => {
    const result = validateManifestJson(
      JSON.stringify({
        entries: [{ containerName: 'b', dataPath: 'data/events' }],
      })
    );

    expect(result.status).toBe('ok');

    if (result.status === 'ok') {
      expect(result.entryCount).toBe(1);
    }
  });

  it('accepts a manifest with all supported fields', () => {
    const result = validateManifestJson(
      JSON.stringify({
        entries: [
          {
            containerName: 'b',
            dataPath: 'data/**/*.parquet',
            structureFormat: 'parquet',
            unstructuredData: false,
            unstructuredFormats: ['png'],
            separator: ',',
            isPartitioned: true,
            autoPartitionDetection: true,
            excludePaths: ['_delta_log'],
            excludePatterns: ['tmp/*'],
            partitionColumns: [
              { name: 'year', dataType: 'INT', dataTypeDisplay: 'Year' },
            ],
            depth: 0,
          },
        ],
      })
    );

    expect(result.status).toBe('ok');
  });

  it('counts multiple entries correctly', () => {
    const result = validateManifestJson(
      JSON.stringify({
        entries: [
          { containerName: 'b', dataPath: 'a' },
          { containerName: 'b', dataPath: 'b' },
          { containerName: 'b', dataPath: 'c' },
        ],
      })
    );

    expect(result.status).toBe('ok');

    if (result.status === 'ok') {
      expect(result.entryCount).toBe(3);
    }
  });

  it('rejects non-object entries', () => {
    const result = validateManifestJson(
      JSON.stringify({ entries: ['not an entry'] })
    );

    expect(result.status).toBe('error');

    if (
      result.status === 'error' &&
      result.error.code === 'entry-must-be-object'
    ) {
      expect(result.error.index).toBe(1);
    }
  });
});

// ----------------------------------------------------------------------
// ManifestJsonWidget rendering
// ----------------------------------------------------------------------

describe('ManifestJsonWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays the sample JSON as a placeholder when value is empty (without writing it to form state)', () => {
    const onChange = jest.fn();
    render(<ManifestJsonWidget {...makeProps({ value: '', onChange })} />);

    expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
    // Sample is displayed in the editor...
    expect(screen.getByTestId('schema-editor')).toHaveTextContent(/"entries"/);
    // ...but we do NOT call onChange on mount — the field may be
    // populated asynchronously from the saved pipeline config.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('displays the sample when value is null without mutating form state', () => {
    const onChange = jest.fn();
    render(
      <ManifestJsonWidget
        {...makeProps({ value: null as unknown as string, onChange })}
      />
    );

    expect(screen.getByTestId('schema-editor')).toHaveTextContent(/"entries"/);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('swallows onChange when disabled', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <ManifestJsonWidget
        {...makeProps({ value: '', onChange, disabled: true })}
      />
    );

    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <ManifestJsonWidget
        {...makeProps({ value: '', onChange, disabled: true })}
      />
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not overwrite a pre-existing value on mount', () => {
    const onChange = jest.fn();
    render(
      <ManifestJsonWidget
        {...makeProps({
          value: '{"entries":[{"containerName":"b","dataPath":"x"}]}',
          onChange,
        })}
      />
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a success alert for a valid manifest', () => {
    render(
      <ManifestJsonWidget
        {...makeProps({
          value: JSON.stringify({
            entries: [
              { containerName: 'b', dataPath: 'a' },
              { containerName: 'b', dataPath: 'b' },
            ],
          }),
        })}
      />
    );

    // In test, t(key, params) returns just the key.
    expect(
      screen.getByText(/label.valid-manifest-entry-count/)
    ).toBeInTheDocument();
  });

  it('shows the success i18n key for one entry too', () => {
    render(
      <ManifestJsonWidget
        {...makeProps({
          value: JSON.stringify({
            entries: [{ containerName: 'b', dataPath: 'a' }],
          }),
        })}
      />
    );

    expect(
      screen.getByText(/label.valid-manifest-entry-count/)
    ).toBeInTheDocument();
  });

  it('shows a localized error alert when the JSON is malformed', () => {
    render(<ManifestJsonWidget {...makeProps({ value: '{ broken' })} />);

    expect(
      screen.getByText(/message.manifest-invalid-json/)
    ).toBeInTheDocument();
  });

  it('wires the SchemaEditor with JSON-aware syntax highlighting', () => {
    render(
      <ManifestJsonWidget
        {...makeProps({
          value: JSON.stringify({
            entries: [{ containerName: 'b', dataPath: 'a' }],
          }),
        })}
      />
    );
    const editor = screen.getByTestId('schema-editor');

    expect(editor).toHaveAttribute('data-mode-name', 'javascript');
    expect(editor).toHaveAttribute('data-mode-json', 'true');
  });

  it('passes readOnly through when disabled', () => {
    render(
      <ManifestJsonWidget
        {...makeProps({
          value: JSON.stringify({
            entries: [{ containerName: 'b', dataPath: 'a' }],
          }),
          disabled: true,
        })}
      />
    );

    expect(screen.getByTestId('schema-editor')).toHaveAttribute(
      'data-readonly',
      'true'
    );
  });

  it('shows the resize hint', () => {
    render(
      <ManifestJsonWidget
        {...makeProps({
          value: JSON.stringify({
            entries: [{ containerName: 'b', dataPath: 'a' }],
          }),
        })}
      />
    );

    expect(
      screen.getByText(/message.drag-bottom-right-corner-to-resize/)
    ).toBeInTheDocument();
  });
});
