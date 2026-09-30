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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { searchQuery } from '../../../../rest/searchAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { CustomPropertyCard } from './CustomPropertyCard';

jest.mock('../../../Database/SchemaEditor/SchemaEditor', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        value,
        onChange,
      }: {
        value?: string;
        onChange?: (value: string) => void;
      }) => (
        <textarea
          aria-label="schema-editor"
          data-testid="schema-editor"
          readOnly={!onChange}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
        />
      )
    )
);

jest.mock('../../RichTextEditor/RichTextEditor', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        initialValue,
        onTextChange,
      }: {
        initialValue?: string;
        onTextChange?: (value: string) => void;
      }) => (
        <textarea
          aria-label="markdown-editor"
          data-testid="markdown-editor"
          defaultValue={initialValue}
          onChange={(event) => onTextChange?.(event.target.value)}
        />
      )
    )
);

jest.mock('../../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }: { markdown: string }) => (
      <div data-testid="markdown-preview">{markdown}</div>
    ))
);

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../utils/EntityUtilClassBase', () => ({
  getEntityLink: jest.fn((type: string, fqn: string) => `/${type}/${fqn}`),
}));

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (
  typeName: string,
  config?: unknown
): CustomProperty => ({
  name: 'prop',
  displayName: 'Prop',
  description: '',
  propertyType: { id: `${typeName}-id`, name: typeName, type: 'type' },
  ...(config === undefined
    ? {}
    : {
        customPropertyConfig: {
          config: config as NonNullable<
            CustomProperty['customPropertyConfig']
          >['config'],
        },
      }),
});

// jsdom has no layout, so CollapsibleChipList would fit every chip on one
// line. Report any child past the first three (two chips + the toggle) as
// wrapped to the next line.
const simulateTwoChipsPerLine = () =>
  jest
    .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
    .mockImplementation(function (this: HTMLElement) {
      const siblings = Array.from(this.parentElement?.children ?? []);

      return siblings.indexOf(this) > 2 ? 24 : 0;
    });

// Four children per line, centred like the real row: the "+N more" toggle is
// shorter than a chip and sits 3px lower on the same line.
const simulateCentredRowWithShortToggle = () => {
  const isToggle = (element: HTMLElement) => element.tagName === 'BUTTON';
  jest
    .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
    .mockImplementation(function (this: HTMLElement) {
      const siblings = Array.from(this.parentElement?.children ?? []);
      const row = siblings.indexOf(this) > 3 ? 32 : 0;

      return row + (isToggle(this) ? 3 : 0);
    });
  jest
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return isToggle(this) ? 20 : 26;
    });
};

const renderCard = (property: CustomProperty, value: unknown) => {
  const onValueSave = jest.fn().mockResolvedValue(undefined);

  render(
    <MemoryRouter>
      <CustomPropertyCard
        hasEditPermissions
        property={property}
        value={value}
        onValueSave={onValueSave}
      />
    </MemoryRouter>
  );

  return { onValueSave };
};

const references = Array.from({ length: 4 }, (_, index) => ({
  id: `id-${index}`,
  type: 'table',
  name: `table_${index}`,
  fullyQualifiedName: `svc.db.schema.table_${index}`,
}));

describe('Custom property renderers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('date', () => {
    it('shows the stored value and re-saves it unchanged', async () => {
      const { onValueSave } = renderCard(
        createProperty('date-cp', 'yyyy-MM-dd'),
        '2026-09-23'
      );

      expect(screen.getByTestId('value')).toHaveTextContent('2026-09-23');

      await user.click(screen.getByTestId('edit-icon'));
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), '2026-09-23');
    });

    it('edits the seconds of a date-time and keeps the date', async () => {
      const { onValueSave } = renderCard(
        createProperty('dateTime-cp', 'yyyy-MM-dd HH:mm:ss'),
        '2026-09-23 14:30:15'
      );

      await user.click(screen.getByTestId('edit-icon'));
      const modal = screen.getByTestId('custom-property-edit-modal');

      expect(within(modal).getByTestId('date-time-picker')).toBeInTheDocument();

      const [, , seconds] = within(
        within(modal).getByTestId('time-picker')
      ).getAllByRole('spinbutton');
      await user.click(seconds);
      await user.keyboard('{ArrowUp}');
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(
        expect.anything(),
        '2026-09-23 14:30:16'
      );
    });

    it('edits a time value with hour, minute and second segments', async () => {
      const { onValueSave } = renderCard(
        createProperty('time-cp', 'HH:mm:ss'),
        '15:35:59'
      );

      await user.click(screen.getByTestId('edit-icon'));
      const segments = within(screen.getByTestId('time-picker')).getAllByRole(
        'spinbutton'
      );

      expect(
        segments.map((segment) => segment.getAttribute('aria-valuenow'))
      ).toEqual(['15', '35', '59']);

      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), '15:35:59');
    });
  });

  describe('enum', () => {
    const property = createProperty('enum', {
      values: ['Gold', 'Silver', 'Tier 1'],
      multiSelect: true,
    });

    it('shows every selected option', () => {
      renderCard(property, ['Gold', 'Tier 1']);

      expect(screen.getByTestId('enum-value')).toHaveTextContent('Gold');
      expect(screen.getByTestId('enum-value')).toHaveTextContent('Tier 1');
    });

    it('collapses long selections behind "+N more" and expands them back', async () => {
      const values = ['CC-1', 'CC-2', 'CC-3', 'CC-4', 'CC-5', 'CC-6'];
      simulateTwoChipsPerLine();
      renderCard(createProperty('enum', { values, multiSelect: true }), values);

      expect(screen.queryByTestId('enum-option-CC-5')).not.toBeInTheDocument();

      const toggle = screen.getByTestId('toggle-collapsed-values');

      expect(toggle).toHaveTextContent('label.plus-count-more');

      await user.click(toggle);

      expect(screen.getByTestId('enum-option-CC-6')).toBeInTheDocument();
      expect(toggle).toHaveTextContent('label.show-less');
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      await user.click(toggle);

      expect(screen.queryByTestId('enum-option-CC-6')).not.toBeInTheDocument();
    });

    it('keeps every chip that fits beside the "+N more" toggle', () => {
      const values = ['CC-1', 'CC-2', 'CC-3', 'CC-4', 'CC-5', 'CC-6'];
      simulateCentredRowWithShortToggle();
      renderCard(createProperty('enum', { values, multiSelect: true }), values);

      expect(screen.getByTestId('enum-option-CC-3')).toBeInTheDocument();
      expect(screen.queryByTestId('enum-option-CC-4')).not.toBeInTheDocument();
      expect(screen.getByTestId('toggle-collapsed-values')).toBeInTheDocument();
    });

    it('saves the selection and reports the count', async () => {
      const { onValueSave } = renderCard(property, ['Gold', 'Tier 1']);

      await user.click(screen.getByTestId('edit-icon'));

      expect(
        screen.getByText('message.count-of-total-selected')
      ).toBeInTheDocument();

      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), [
        'Gold',
        'Tier 1',
      ]);
    });

    it('replaces the value when a single-select picks another option', async () => {
      const { onValueSave } = renderCard(
        createProperty('enum', {
          values: ['Gold', 'Silver', 'Tier 1'],
          multiSelect: false,
        }),
        ['Gold']
      );

      await user.click(screen.getByTestId('edit-icon'));
      const input = within(screen.getByTestId('enum-select')).getByRole(
        'combobox'
      );

      expect(input).toBeVisible();

      await user.click(input);
      await user.click(await screen.findByRole('option', { name: 'Silver' }));
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), ['Silver']);
    });
  });

  describe('hyperlink', () => {
    it('never renders an unsafe href', () => {
      renderCard(createProperty('hyperlink-cp'), {
        url: 'javascript:alert(1)',
        displayText: 'Click',
      });

      expect(screen.getByTestId('hyperlink-value')).toHaveAttribute(
        'href',
        '#'
      );
    });

    it('rejects a non-http url', async () => {
      const { onValueSave } = renderCard(createProperty('hyperlink-cp'), {
        url: 'https://example.com',
      });

      await user.click(screen.getByTestId('edit-icon'));
      const urlInput = screen.getByTestId('hyperlink-url-input');
      await user.clear(urlInput);
      await user.type(urlInput, 'javascript:alert(1)');
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).not.toHaveBeenCalled();
      expect(
        screen.getByText('message.url-must-use-http-or-https')
      ).toBeInTheDocument();
    });

    it('saves the url and display text', async () => {
      const { onValueSave } = renderCard(createProperty('hyperlink-cp'), {
        url: 'https://example.com',
      });

      await user.click(screen.getByTestId('edit-icon'));
      await user.type(
        screen.getByTestId('hyperlink-display-text-input'),
        'Runbook'
      );
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), {
        url: 'https://example.com',
        displayText: 'Runbook',
      });
    });

    it('requires a url when display text is set', async () => {
      const { onValueSave } = renderCard(createProperty('hyperlink-cp'), {
        url: 'https://example.com',
      });

      await user.click(screen.getByTestId('edit-icon'));
      await user.clear(screen.getByTestId('hyperlink-url-input'));
      await user.type(
        screen.getByTestId('hyperlink-display-text-input'),
        'Runbook'
      );
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).not.toHaveBeenCalled();
      expect(screen.getByText('label.field-required')).toBeInTheDocument();
    });

    it('clears the value when url and display text are empty', async () => {
      const { onValueSave } = renderCard(createProperty('hyperlink-cp'), {
        url: 'https://example.com',
      });

      await user.click(screen.getByTestId('edit-icon'));
      await user.clear(screen.getByTestId('hyperlink-url-input'));
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), undefined);
    });

    it('shows an example url while empty', () => {
      renderCard(createProperty('hyperlink-cp'), undefined);

      expect(screen.getByTestId('no-data')).toHaveTextContent(
        'message.example-value'
      );
    });
  });

  describe('entity reference', () => {
    it('shows two references and expands the rest', async () => {
      simulateTwoChipsPerLine();
      renderCard(createProperty('entityReferenceList', ['table']), references);

      expect(screen.getByTestId('table_0')).toBeInTheDocument();
      expect(screen.queryByTestId('table_2')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('toggle-collapsed-values'));

      expect(screen.getByTestId('table_3')).toBeInTheDocument();
      expect(screen.getByTestId('property-item-count')).toHaveTextContent('4');
    });

    it('searches the configured index and saves the kept references', async () => {
      (searchQuery as jest.Mock).mockResolvedValue({
        hits: { hits: [], total: { value: 0 } },
      });
      const { onValueSave } = renderCard(
        createProperty('entityReferenceList', ['table']),
        references.slice(0, 2)
      );

      await user.click(screen.getByTestId('edit-icon'));

      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ query: '*', searchIndex: 'table' })
      );

      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(
        expect.anything(),
        references.slice(0, 2)
      );
    });

    it('adds a searched reference to the list', async () => {
      (searchQuery as jest.Mock).mockResolvedValue({
        hits: {
          hits: [{ _source: { ...references[3], entityType: 'table' } }],
          total: { value: 1 },
        },
      });
      const { onValueSave } = renderCard(
        createProperty('entityReferenceList', ['table']),
        references.slice(0, 1)
      );

      await user.click(screen.getByTestId('edit-icon'));
      await user.type(screen.getByRole('combobox'), 'table');
      await user.click(await screen.findByTestId('table_3'));
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), [
        references[0],
        expect.objectContaining({ id: 'id-3', type: 'table' }),
      ]);
    });

    it('swaps a single reference after clearing the current one', async () => {
      (searchQuery as jest.Mock).mockResolvedValue({
        hits: {
          hits: [{ _source: { ...references[1], entityType: 'table' } }],
          total: { value: 1 },
        },
      });
      const { onValueSave } = renderCard(
        createProperty('entityReference', ['table']),
        references[0]
      );

      await user.click(screen.getByTestId('edit-icon'));
      await user.click(
        within(screen.getByTestId('autocomplete-selected-item')).getByRole(
          'button'
        )
      );
      await user.type(screen.getByRole('combobox'), 'table');
      await user.click(await screen.findByTestId('table_1'));
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'id-1' })
      );
    });

    it('removes a selected reference', async () => {
      (searchQuery as jest.Mock).mockResolvedValue({
        hits: { hits: [], total: { value: 0 } },
      });
      const { onValueSave } = renderCard(
        createProperty('entityReferenceList', ['table']),
        references.slice(0, 2)
      );

      await user.click(screen.getByTestId('edit-icon'));
      const [firstChip] = screen.getAllByTestId('autocomplete-selected-item');
      await user.click(within(firstChip).getByRole('button'));
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), [
        references[1],
      ]);
    });

    it('shows an error toast when the search fails', async () => {
      const error = new Error('search failed');
      (searchQuery as jest.Mock).mockRejectedValue(error);
      renderCard(
        createProperty('entityReferenceList', ['table']),
        references.slice(0, 1)
      );

      await user.click(screen.getByTestId('edit-icon'));

      await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));
    });
  });

  describe('table', () => {
    const property = createProperty('table-cp', {
      columns: ['column', 'meaning'],
    });

    it('shows the stored rows', () => {
      renderCard(property, {
        columns: ['column', 'meaning'],
        rows: [{ column: 'customer_id', meaning: 'Unique key' }],
      });

      expect(screen.getByTestId('table-type-property-value')).toHaveTextContent(
        'customer_id'
      );
      expect(screen.getByTestId('property-item-count')).toHaveTextContent('1');
    });

    it('adds and deletes rows and drops empty rows on save', async () => {
      const { onValueSave } = renderCard(property, undefined);

      await user.click(screen.getByTestId('add-value-button'));
      await user.type(screen.getByTestId('column-0'), 'order_id');
      await user.click(screen.getByTestId('add-new-row'));
      await user.click(screen.getByTestId('add-new-row'));
      await user.type(screen.getByTestId('meaning-2'), 'Removed');
      await user.click(screen.getByTestId('delete-row-2'));
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), {
        columns: ['column', 'meaning'],
        rows: [{ column: 'order_id' }],
      });
    });
  });

  describe('sql query', () => {
    it('saves the edited query', async () => {
      const { onValueSave } = renderCard(
        createProperty('sqlQuery'),
        'SELECT 1'
      );

      await user.click(screen.getByTestId('edit-icon'));
      const editor = await within(
        screen.getByTestId('custom-property-edit-modal')
      ).findByTestId('schema-editor');
      await user.clear(editor);
      await user.type(editor, 'SELECT 2');
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), 'SELECT 2');
    });
  });

  describe('markdown', () => {
    it('previews and saves markdown', async () => {
      const { onValueSave } = renderCard(createProperty('markdown'), '**Hi**');

      expect(await screen.findByTestId('markdown-preview')).toHaveTextContent(
        '**Hi**'
      );

      await user.click(screen.getByTestId('edit-icon'));
      const editor = await screen.findByTestId('markdown-editor');
      await user.clear(editor);
      await user.type(editor, 'Notes');
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), 'Notes');
    });
  });

  describe('time interval', () => {
    const start = 1790195220000;
    const end = 1790418420000;

    it('renders the interval with its raw bounds', () => {
      renderCard(createProperty('timeInterval'), { start, end });

      const interval = screen.getByTestId('time-interval-value');

      expect(interval).toHaveAttribute('data-start', String(start));
      expect(interval).toHaveAttribute('data-end', String(end));
      expect(screen.getByTestId('time-interval-start')).toBeInTheDocument();
      expect(screen.getByTestId('time-interval-end')).toBeInTheDocument();
    });

    it('renders a legacy single-bound value as plain text', () => {
      renderCard(createProperty('timeInterval'), { start });

      expect(screen.getByTestId('time-interval-value')).toHaveTextContent(
        String(start)
      );
      expect(
        screen.queryByTestId('time-interval-start')
      ).not.toBeInTheDocument();
    });

    it('keeps manual edits after switching back to the calendar', async () => {
      const { onValueSave } = renderCard(createProperty('timeInterval'), {
        start,
        end,
      });

      await user.click(screen.getByTestId('edit-icon'));
      await user.click(screen.getByRole('switch'));
      const startInput = screen.getByTestId('start-input');
      await user.clear(startInput);
      await user.type(startInput, '1790195280000');
      await user.click(screen.getByRole('switch'));

      expect(screen.queryByTestId('start-input')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), {
        start: 1790195280000,
        end,
      });
    });

    it('moves both bounds to the picked calendar days', async () => {
      const preciseStart = start + 30_500;
      const { onValueSave } = renderCard(createProperty('timeInterval'), {
        start: preciseStart,
        end,
      });

      await user.click(screen.getByTestId('edit-icon'));
      const calendar = screen.getByRole('grid');
      await user.click(within(calendar).getByText('10'));
      await user.click(within(calendar).getByText('12'));
      await user.click(screen.getByTestId('inline-save-btn'));

      const saved = onValueSave.mock.calls[0][1];

      expect(new Date(saved.start).getDate()).toBe(10);
      expect(new Date(saved.end).getDate()).toBe(12);
      expect(new Date(saved.start).getHours()).toBe(new Date(start).getHours());
      expect(saved.start % 60_000).toBe(30_500);
    });

    it('switches the editor to UTC', async () => {
      renderCard(createProperty('timeInterval'), { start, end });

      await user.click(screen.getByTestId('edit-icon'));
      await user.click(screen.getByRole('button', { name: /label.timezone/ }));
      await user.click(screen.getByRole('option', { name: 'label.utc' }));

      expect(
        screen.getByRole('button', { name: /label.timezone/ })
      ).toHaveTextContent('label.utc');
    });

    it('saves epoch bounds entered manually', async () => {
      const { onValueSave } = renderCard(createProperty('timeInterval'), {
        start,
        end,
      });

      await user.click(screen.getByTestId('edit-icon'));
      await user.click(screen.getByRole('switch'));
      const endInput = screen.getByTestId('end-input');
      await user.clear(endInput);
      await user.type(endInput, '1790418480000');
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).toHaveBeenCalledWith(expect.anything(), {
        start,
        end: 1790418480000,
      });
    });

    it('rejects an end before the start', async () => {
      const { onValueSave } = renderCard(createProperty('timeInterval'), {
        start,
        end,
      });

      await user.click(screen.getByTestId('edit-icon'));
      await user.click(screen.getByRole('switch'));
      const endInput = screen.getByTestId('end-input');
      await user.clear(endInput);
      await user.type(endInput, '1690418480000');
      await user.click(screen.getByTestId('inline-save-btn'));

      expect(onValueSave).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'message.time-interval-end-before-start'
      );
    });

    it('applies a quick-select range', async () => {
      const { onValueSave } = renderCard(
        createProperty('timeInterval'),
        undefined
      );

      await user.click(screen.getByTestId('add-value-button'));
      await user.click(screen.getByTestId('time-interval-preset-today'));
      await user.click(screen.getByTestId('inline-save-btn'));

      await waitFor(() => expect(onValueSave).toHaveBeenCalled());

      const saved = onValueSave.mock.calls[0][1];

      expect(saved.end - saved.start).toBe((24 * 60 - 1) * 60 * 1000);
    });
  });
});
