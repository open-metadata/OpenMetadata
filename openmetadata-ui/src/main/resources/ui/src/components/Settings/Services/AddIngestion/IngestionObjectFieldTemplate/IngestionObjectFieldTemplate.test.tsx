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
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { IngestionObjectFieldTemplate } from './IngestionObjectFieldTemplate';

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  ChevronDown: () => <span data-testid="chevron" />,
  Plus: () => <span data-testid="plus" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const field = (
  name: string,
  hidden = false
): ObjectFieldTemplatePropertyType => ({
  name,
  content: (
    <div data-testid={`field-${name}`} id={`root/${name}`}>
      {name}
    </div>
  ),
  readonly: false,
  disabled: false,
  hidden,
});

const schemaProperties = {
  name: { type: 'string' },
  type: { type: 'string' },
  tableFilterPattern: { type: 'object' },
  schemaFilterPattern: { type: 'object' },
  includeTables: { type: 'boolean' },
  includeTags: { type: 'boolean' },
  confidence: { type: 'number', minimum: 0, maximum: 1 },
  sampleDataCount: { type: 'integer', minimum: 1, maximum: 1000 },
  connectionArguments: { type: 'object' },
};

const getRootProps = (
  overrides?: Partial<ObjectFieldTemplateProps>
): ObjectFieldTemplateProps =>
  ({
    idSchema: { $id: 'root' },
    title: 'Test',
    schema: { properties: schemaProperties },
    properties: [
      field('name'),
      field('type'),
      field('tableFilterPattern'),
      field('schemaFilterPattern'),
      field('includeTables'),
      field('includeTags'),
      field('confidence'),
      field('sampleDataCount'),
      field('connectionArguments'),
    ],
    ...overrides,
  } as unknown as ObjectFieldTemplateProps);

// jsdom does not process Tailwind CSS, so tw:hidden does not affect
// toBeVisible(). Instead, check the wrapper div's class list.
const isFieldHidden = (container: HTMLElement, testId: string): boolean => {
  const el = within(container).getByTestId(testId);
  const wrapper = el.closest('.property-wrapper');

  return wrapper?.classList.contains('tw:hidden') ?? false;
};

// SectionFields renders wide fields with tw:w-full on the property-wrapper.
const isFieldWide = (testId: string): boolean => {
  const el = screen.getByTestId(testId);
  const wrapper = el.closest('.property-wrapper');

  return wrapper?.classList.contains('tw:w-full') ?? false;
};

describe('IngestionObjectFieldTemplate', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Essential (non-collapsible) section', () => {
    it('renders primary fields without a collapse chevron', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const essential = screen.getByTestId('ingestion-section-essential');

      expect(within(essential).getByTestId('field-name')).toBeInTheDocument();
      expect(within(essential).getByTestId('field-type')).toBeInTheDocument();
      expect(
        within(essential).queryByTestId('chevron')
      ).not.toBeInTheDocument();
    });

    it('always shows the body (no collapse behaviour)', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const essential = screen.getByTestId('ingestion-section-essential');

      fireEvent.click(
        within(essential).getByTestId('ingestion-section-essential-toggle')
      );

      expect(within(essential).getByTestId('field-name')).toBeInTheDocument();
      expect(isFieldHidden(essential, 'field-name')).toBe(false);
    });
  });

  describe('Collapsible sections — collapsed state (default)', () => {
    it('keeps all advanced fields mounted in the DOM when collapsed', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const advanced = screen.getByTestId('ingestion-section-advanced');

      expect(
        within(advanced).getByTestId('ingestion-section-advanced-toggle')
      ).toBeInTheDocument();

      // transformErrors discards errors whose field elements are absent from
      // the DOM, so collapsed sections must keep fields mounted (tw:hidden)
      // to preserve validation.
      expect(
        within(advanced).getByTestId('field-confidence')
      ).toBeInTheDocument();
      expect(
        within(advanced).getByTestId('field-sampleDataCount')
      ).toBeInTheDocument();
      expect(
        within(advanced).getByTestId('field-connectionArguments')
      ).toBeInTheDocument();

      // Fields are hidden via tw:hidden class, not unmounted
      expect(isFieldHidden(advanced, 'field-confidence')).toBe(true);
      expect(isFieldHidden(advanced, 'field-sampleDataCount')).toBe(true);
      expect(isFieldHidden(advanced, 'field-connectionArguments')).toBe(true);
    });

    it('auto-expands a collapsed section when it has validation errors', () => {
      const props = getRootProps({
        errorSchema: {
          confidence: { __errors: ['must be <= 1'] },
        },
      } as unknown as ObjectFieldTemplateProps);

      render(<IngestionObjectFieldTemplate {...props} />);

      const advanced = screen.getByTestId('ingestion-section-advanced');

      expect(isFieldHidden(advanced, 'field-confidence')).toBe(false);
      expect(isFieldHidden(advanced, 'field-sampleDataCount')).toBe(false);
    });

    it('does not expand a section that has no validation errors', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const advanced = screen.getByTestId('ingestion-section-advanced');

      expect(isFieldHidden(advanced, 'field-confidence')).toBe(true);
    });

    it('keeps all filter-pattern fields mounted when collapsed', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const filters = screen.getByTestId('ingestion-section-filters');

      expect(
        within(filters).getByTestId('field-tableFilterPattern')
      ).toBeInTheDocument();
      expect(
        within(filters).getByTestId('field-schemaFilterPattern')
      ).toBeInTheDocument();

      expect(isFieldHidden(filters, 'field-tableFilterPattern')).toBe(true);
      expect(isFieldHidden(filters, 'field-schemaFilterPattern')).toBe(true);
    });

    it('keeps all scope-and-behaviour fields mounted when collapsed', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const scope = screen.getByTestId('ingestion-section-scope');

      expect(
        within(scope).getByTestId('field-includeTables')
      ).toBeInTheDocument();
      expect(
        within(scope).getByTestId('field-includeTags')
      ).toBeInTheDocument();

      expect(isFieldHidden(scope, 'field-includeTables')).toBe(true);
      expect(isFieldHidden(scope, 'field-includeTags')).toBe(true);
    });

    it('preserves the DOM id that transformErrors looks up for advanced fields', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      // transformErrors uses document.getElementById('root/sampleDataCount')
      // to decide whether to customise the error message. The element must
      // exist even when the section is collapsed.
      expect(document.getElementById('root/sampleDataCount')).not.toBeNull();
      expect(document.getElementById('root/confidence')).not.toBeNull();
      expect(
        document.getElementById('root/connectionArguments')
      ).not.toBeNull();
    });
  });

  describe('Collapsible sections — expanded state', () => {
    it('renders advanced fields without tw:hidden after expanding', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const advanced = screen.getByTestId('ingestion-section-advanced');

      fireEvent.click(
        within(advanced).getByTestId('ingestion-section-advanced-toggle')
      );

      expect(
        within(advanced).getByTestId('field-confidence')
      ).toBeInTheDocument();
      expect(
        within(advanced).getByTestId('field-sampleDataCount')
      ).toBeInTheDocument();
      expect(
        within(advanced).getByTestId('field-connectionArguments')
      ).toBeInTheDocument();

      expect(isFieldHidden(advanced, 'field-confidence')).toBe(false);
      expect(isFieldHidden(advanced, 'field-sampleDataCount')).toBe(false);
    });

    it('renders filter-pattern fields without tw:hidden after expanding', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const filters = screen.getByTestId('ingestion-section-filters');

      fireEvent.click(
        within(filters).getByTestId('ingestion-section-filters-toggle')
      );

      expect(isFieldHidden(filters, 'field-tableFilterPattern')).toBe(false);
      expect(isFieldHidden(filters, 'field-schemaFilterPattern')).toBe(false);
    });

    it('renders scope-and-behaviour fields without tw:hidden after expanding', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const scope = screen.getByTestId('ingestion-section-scope');

      fireEvent.click(
        within(scope).getByTestId('ingestion-section-scope-toggle')
      );

      expect(isFieldHidden(scope, 'field-includeTables')).toBe(false);
      expect(isFieldHidden(scope, 'field-includeTags')).toBe(false);
    });
  });

  describe('Collapsible sections — collapse after expand keeps fields mounted', () => {
    it('keeps advanced fields in the DOM with tw:hidden after collapsing', () => {
      render(<IngestionObjectFieldTemplate {...getRootProps()} />);

      const advanced = screen.getByTestId('ingestion-section-advanced');
      const toggle = within(advanced).getByTestId(
        'ingestion-section-advanced-toggle'
      );

      fireEvent.click(toggle);

      expect(isFieldHidden(advanced, 'field-confidence')).toBe(false);

      fireEvent.click(toggle);

      // Collapsed fields must stay in the DOM (hidden via tw:hidden) so
      // transformErrors can still find their elements.
      expect(
        within(advanced).queryByTestId('field-confidence')
      ).toBeInTheDocument();
      expect(
        within(advanced).queryByTestId('field-sampleDataCount')
      ).toBeInTheDocument();
      expect(isFieldHidden(advanced, 'field-confidence')).toBe(true);
      expect(isFieldHidden(advanced, 'field-sampleDataCount')).toBe(true);
    });
  });

  describe('Collapsible section with only hidden fields', () => {
    it('omits the advanced card when all advanced fields are hidden', () => {
      const props = getRootProps({
        properties: [
          field('name'),
          field('type'),
          { ...field('confidence'), hidden: true },
          { ...field('sampleDataCount'), hidden: true },
        ],
      } as unknown as ObjectFieldTemplateProps);

      render(<IngestionObjectFieldTemplate {...props} />);

      expect(
        screen.queryByTestId('ingestion-section-advanced')
      ).not.toBeInTheDocument();

      expect(screen.getByTestId('field-name')).toBeInTheDocument();
      expect(screen.getByTestId('field-type')).toBeInTheDocument();
    });
  });

  describe('Non-root level rendering', () => {
    it('renders SectionFields for non-root non-additionalProperties objects', () => {
      const props = {
        idSchema: { $id: 'root/nested' },
        title: 'Nested',
        schema: { properties: schemaProperties },
        properties: [field('name'), field('type')],
      } as unknown as ObjectFieldTemplateProps;

      render(<IngestionObjectFieldTemplate {...props} />);

      expect(screen.getByTestId('field-name')).toBeInTheDocument();
      expect(screen.getByTestId('field-type')).toBeInTheDocument();
    });

    it('renders additional properties with add button and label for additionalProperties objects', () => {
      const onAddClick = jest.fn(() => () => {});
      const props = {
        idSchema: { $id: 'root/nested' },
        title: 'Custom',
        schema: {
          title: 'Catalog Mapping',
          additionalProperties: true,
          properties: schemaProperties,
        },
        properties: [field('entry1')],
        onAddClick,
      } as unknown as ObjectFieldTemplateProps;

      render(<IngestionObjectFieldTemplate {...props} />);

      expect(screen.getByText('Catalog Mapping')).toBeInTheDocument();

      const addBtn = screen.getByLabelText('label.add-entity');

      expect(addBtn).toBeInTheDocument();

      fireEvent.click(addBtn);

      expect(onAddClick).toHaveBeenCalled();
    });

    it('renders the fallback label when schema has no title', () => {
      const props = {
        idSchema: { $id: 'root/nested' },
        title: 'Custom',
        schema: { additionalProperties: true, properties: schemaProperties },
        properties: [field('entry1')],
        onAddClick: jest.fn(),
      } as unknown as ObjectFieldTemplateProps;

      render(<IngestionObjectFieldTemplate {...props} />);

      expect(
        screen.getByText('label.additional-property-plural')
      ).toBeInTheDocument();
    });

    it('renders empty message when no visible properties exist for additionalProperties object', () => {
      const props = {
        idSchema: { $id: 'root/nested' },
        title: 'Custom',
        schema: { additionalProperties: true, properties: schemaProperties },
        properties: [],
        onAddClick: jest.fn(),
      } as unknown as ObjectFieldTemplateProps;

      render(<IngestionObjectFieldTemplate {...props} />);

      expect(
        screen.getByText('message.no-properties-added')
      ).toBeInTheDocument();
    });
  });

  describe('Wide field rendering (isWide)', () => {
    it('treats uiFieldType code as wide', () => {
      const wideSchemaProps = {
        codeField: { type: 'string', uiFieldType: 'code' },
        name: { type: 'string' },
      };
      const props = {
        idSchema: { $id: 'root/' },
        schema: { properties: wideSchemaProps },
        properties: [field('name'), field('codeField')],
      } as unknown as ObjectFieldTemplateProps;

      render(<IngestionObjectFieldTemplate {...props} />);

      expect(isFieldWide('field-codeField')).toBe(true);
      expect(isFieldWide('field-name')).toBe(false);
    });

    it('treats object and array types as wide', () => {
      const wideSchemaProps = {
        objField: { type: 'object' },
        arrField: { type: 'array' },
        name: { type: 'string' },
      };
      const props = {
        idSchema: { $id: 'root/test' },
        schema: { properties: wideSchemaProps },
        properties: [field('name'), field('objField'), field('arrField')],
      } as unknown as ObjectFieldTemplateProps;

      render(<IngestionObjectFieldTemplate {...props} />);

      expect(isFieldWide('field-objField')).toBe(true);
      expect(isFieldWide('field-arrField')).toBe(true);
      expect(isFieldWide('field-name')).toBe(false);
    });

    it('treats oneOf variants with object/array types as wide', () => {
      const wideSchemaProps = {
        variantField: { oneOf: [{ type: 'object' }, { type: 'null' }] },
        name: { type: 'string' },
      };
      const props = {
        idSchema: { $id: 'root/test2' },
        schema: { properties: wideSchemaProps },
        properties: [field('name'), field('variantField')],
      } as unknown as ObjectFieldTemplateProps;

      render(<IngestionObjectFieldTemplate {...props} />);

      expect(isFieldWide('field-variantField')).toBe(true);
      expect(isFieldWide('field-name')).toBe(false);
    });
  });
});
