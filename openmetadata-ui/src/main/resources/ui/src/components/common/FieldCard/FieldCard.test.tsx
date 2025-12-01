/*
 *  Copyright 2025 Collate.
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
import { startCase } from 'lodash';
import { ConstraintType } from '../../../generated/entity/data/table';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import FieldCard from './FieldCard';

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// Mock RichTextEditorPreviewerV1 to render content
jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="rte-previewer">{markdown}</div>
    ))
);

// Spy on utils
jest.mock('../../../utils/TableUtils', () => ({
  getDataTypeString: jest.fn((text: string) => `DT:${text}`),
  prepareConstraintIcon: jest.fn(() => (
    <span data-testid="constraint-icon">ICON</span>
  )),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn((entity) => entity?.displayName || entity?.name || ''),
}));

const { getDataTypeString, prepareConstraintIcon } = jest.requireMock(
  '../../../utils/TableUtils'
);

const { getEntityName } = jest.requireMock('../../../utils/EntityUtils');

const mockTags = [
  {
    tagFQN: 'Classification.PII.Sensitive',
    name: 'Sensitive',
    displayName: 'Sensitive Data',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'Classification.Security.Public',
    name: 'Public',
    displayName: 'Public Data',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'Classification.Compliance.GDPR',
    name: 'GDPR',
    displayName: 'GDPR Compliant',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

const mockGlossaryTerms = [
  {
    tagFQN: 'Glossary.Customer',
    name: 'Customer',
    displayName: 'Customer Term',
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'Glossary.Product',
    name: 'Product',
    displayName: 'Product Term',
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'Glossary.Revenue',
    name: 'Revenue',
    displayName: 'Revenue Term',
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

const baseProps = {
  fieldName: 'customer_id',
  dataType: 'varchar',
  description: 'Field description',
  tags: [...mockTags.slice(0, 2), ...mockGlossaryTerms.slice(0, 1)],
  columnConstraint: 'PRIMARY_KEY',
  tableConstraints: [
    { constraintType: ConstraintType.PrimaryKey, columns: ['customer_id'] },
  ],
};

describe('FieldCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders basic structure and content', () => {
    const { container } = render(<FieldCard {...baseProps} />);

    expect(container.querySelector('.field-card')).toBeInTheDocument();
    expect(container.querySelector('.field-card-header')).toBeInTheDocument();
    expect(container.querySelector('.field-card-content')).toBeInTheDocument();

    expect(screen.getByText('customer_id')).toBeInTheDocument();
    expect(screen.getByTestId('rte-previewer')).toHaveTextContent(
      'Field description'
    );
  });

  it('renders data type badge using utility', () => {
    render(<FieldCard {...baseProps} />);

    expect(getDataTypeString).toHaveBeenCalled();
    expect(screen.getByText(/^DT:/)).toBeInTheDocument();
  });

  it('renders constraint icon when columnConstraint provided', () => {
    render(<FieldCard {...baseProps} />);

    expect(prepareConstraintIcon).toHaveBeenCalledWith(
      expect.objectContaining({ columnName: 'customer_id' })
    );
    expect(screen.getByTestId('constraint-icon')).toBeInTheDocument();
  });

  it('shows no-description text when description is missing', () => {
    render(<FieldCard {...baseProps} description={undefined} />);

    expect(
      screen.getByText('label.no-entity - {"entity":"label.description"}')
    ).toBeInTheDocument();
  });

  it('applies highlighted class when isHighlighted is true', () => {
    const { container } = render(<FieldCard {...baseProps} isHighlighted />);

    expect(container.querySelector('.field-card')).toHaveClass(
      'field-card-highlighted'
    );
  });

  describe('Tags Display', () => {
    it('renders tag items with icons and names', () => {
      const { container } = render(<FieldCard {...baseProps} />);

      expect(screen.getByText(/label\.tag-plural/)).toBeInTheDocument();

      const tagItems = container.querySelectorAll('.tag-item');

      expect(tagItems).toHaveLength(2);

      expect(
        screen.getByTestId('tag-Classification.PII.Sensitive')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('tag-Classification.Security.Public')
      ).toBeInTheDocument();

      expect(screen.getByText('Sensitive Data')).toBeInTheDocument();
      expect(screen.getByText('Public Data')).toBeInTheDocument();
    });

    it('calls getEntityName for each tag', () => {
      render(<FieldCard {...baseProps} />);

      expect(getEntityName).toHaveBeenCalledWith(
        expect.objectContaining({ tagFQN: 'Classification.PII.Sensitive' })
      );
      expect(getEntityName).toHaveBeenCalledWith(
        expect.objectContaining({ tagFQN: 'Classification.Security.Public' })
      );
    });

    it('shows all tags when they fit in container width', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={mockTags} />
      );

      const tagItems = container.querySelectorAll('.tag-item');

      // In test environment with wide containers, all 3 tags are shown
      expect(tagItems).toHaveLength(3);

      expect(screen.getByText('GDPR Compliant')).toBeInTheDocument();
    });

    it('renders all tags in test environment', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={mockTags} />
      );

      const tagItems = container.querySelectorAll('.tag-item');

      // In test environment with wide containers, all tags are shown
      expect(tagItems).toHaveLength(3);
    });

    it('does not show more button when tags are 2 or less', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={mockTags.slice(0, 2)} />
      );

      expect(
        container.querySelector('.show-more-tags-button')
      ).not.toBeInTheDocument();
    });

    it('does not render tags section when no non-glossary tags', () => {
      render(<FieldCard {...baseProps} tags={mockGlossaryTerms} />);

      expect(screen.queryByText(/label\.tag-plural/)).not.toBeInTheDocument();
    });
  });

  describe('Glossary Terms Display', () => {
    it('renders glossary term items with icons and names', () => {
      const { container } = render(<FieldCard {...baseProps} />);

      expect(
        screen.getByText(/label\.glossary-term-plural/)
      ).toBeInTheDocument();

      const termItems = container.querySelectorAll('.glossary-term-item');

      expect(termItems).toHaveLength(1);

      expect(screen.getByTestId('term-Glossary.Customer')).toBeInTheDocument();
      expect(screen.getByText('Customer Term')).toBeInTheDocument();
    });

    it('calls getEntityName for each glossary term', () => {
      render(<FieldCard {...baseProps} />);

      expect(getEntityName).toHaveBeenCalledWith(
        expect.objectContaining({ tagFQN: 'Glossary.Customer' })
      );
    });

    it('shows all glossary terms when they fit in container width', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={mockGlossaryTerms} />
      );

      const termItems = container.querySelectorAll('.glossary-term-item');

      // In test environment with wide containers, all 3 terms are shown
      expect(termItems).toHaveLength(3);

      expect(screen.getByText('Revenue Term')).toBeInTheDocument();
    });

    it('renders all glossary terms in test environment', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={mockGlossaryTerms} />
      );

      const termItems = container.querySelectorAll('.glossary-term-item');

      // In test environment with wide containers, all terms are shown
      expect(termItems).toHaveLength(3);
    });

    it('does not show more button when glossary terms are 2 or less', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={mockGlossaryTerms.slice(0, 2)} />
      );

      expect(
        container.querySelector('.show-more-terms-button')
      ).not.toBeInTheDocument();
    });

    it('does not render glossary terms section when no glossary terms', () => {
      render(<FieldCard {...baseProps} tags={mockTags} />);

      expect(
        screen.queryByText(/label\.glossary-term-plural/)
      ).not.toBeInTheDocument();
    });
  });

  describe('Mixed Tags and Glossary Terms', () => {
    it('renders both tags and glossary terms sections', () => {
      const { container } = render(
        <FieldCard
          {...baseProps}
          tags={[...mockTags.slice(0, 2), ...mockGlossaryTerms.slice(0, 1)]}
        />
      );

      expect(screen.getByText(/label\.tag-plural/)).toBeInTheDocument();
      expect(
        screen.getByText(/label\.glossary-term-plural/)
      ).toBeInTheDocument();

      const tagItems = container.querySelectorAll('.tag-item');
      const termItems = container.querySelectorAll('.glossary-term-item');

      expect(tagItems).toHaveLength(2);
      expect(termItems).toHaveLength(1);
    });

    it('correctly filters tags and glossary terms by source', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={[...mockTags, ...mockGlossaryTerms]} />
      );

      const tagItems = container.querySelectorAll('.tag-item');
      const termItems = container.querySelectorAll('.glossary-term-item');

      expect(tagItems).toHaveLength(3);
      expect(termItems).toHaveLength(3);
    });
  });

  describe('Empty States', () => {
    it('does not render metadata section when no tags', () => {
      const { container } = render(<FieldCard {...baseProps} tags={[]} />);

      expect(
        container.querySelector('.metadata-section')
      ).not.toBeInTheDocument();
    });

    it('does not render metadata section when tags prop is undefined', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={undefined} />
      );

      expect(
        container.querySelector('.metadata-section')
      ).not.toBeInTheDocument();
    });
  });

  describe('Type Handling', () => {
    it('handles different TagSource types correctly', () => {
      const mixedTags = [
        {
          tagFQN: 'Classification.Type1',
          name: 'Type1',
          displayName: 'Classification Type',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'Glossary.Type2',
          name: 'Type2',
          displayName: 'Glossary Type',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ];

      const { container } = render(
        <FieldCard {...baseProps} tags={mixedTags} />
      );

      const tagItems = container.querySelectorAll('.tag-item');
      const termItems = container.querySelectorAll('.glossary-term-item');

      expect(tagItems).toHaveLength(1);
      expect(termItems).toHaveLength(1);
      expect(screen.getByText('Classification Type')).toBeInTheDocument();
      expect(screen.getByText('Glossary Type')).toBeInTheDocument();
    });

    it('handles tags without displayName gracefully', () => {
      const tagsWithoutDisplayName = [
        {
          tagFQN: 'Classification.NoDisplay',
          name: 'NoDisplayName',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ];

      render(<FieldCard {...baseProps} tags={tagsWithoutDisplayName} />);

      expect(getEntityName).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NoDisplayName' })
      );
      expect(screen.getByText('NoDisplayName')).toBeInTheDocument();
    });

    it('handles tags without name and displayName', () => {
      const tagsWithoutNames = [
        {
          tagFQN: 'Classification.Empty',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ];

      render(<FieldCard {...baseProps} tags={tagsWithoutNames} />);

      expect(getEntityName).toHaveBeenCalledWith(
        expect.objectContaining({ tagFQN: 'Classification.Empty' })
      );
    });

    it('handles different data types correctly', () => {
      const dataTypes = ['varchar', 'int', 'bigint', 'timestamp', 'boolean'];

      dataTypes.forEach((dataType) => {
        const { container } = render(
          <FieldCard {...baseProps} dataType={dataType} />
        );

        expect(getDataTypeString).toHaveBeenCalledWith(startCase(dataType));

        container.remove();
      });
    });

    it('handles complex data type strings', () => {
      const complexDataType = 'array<struct<field1:string,field2:int>>';

      render(<FieldCard {...baseProps} dataType={complexDataType} />);

      expect(getDataTypeString).toHaveBeenCalledWith(
        startCase(complexDataType)
      );
    });

    it('handles undefined columnConstraint', () => {
      render(
        <FieldCard
          {...baseProps}
          columnConstraint={undefined}
          tableConstraints={undefined}
        />
      );

      expect(screen.queryByTestId('constraint-icon')).not.toBeInTheDocument();
    });

    it('handles empty tags array', () => {
      const { container } = render(<FieldCard {...baseProps} tags={[]} />);

      expect(container.querySelector('.tag-item')).not.toBeInTheDocument();
      expect(
        container.querySelector('.glossary-term-item')
      ).not.toBeInTheDocument();
    });

    it('handles tags with only Classification source', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={mockTags} />
      );

      expect(container.querySelectorAll('.tag-item')).toHaveLength(3);
      expect(
        container.querySelector('.glossary-term-item')
      ).not.toBeInTheDocument();
    });

    it('handles tags with only Glossary source', () => {
      const { container } = render(
        <FieldCard {...baseProps} tags={mockGlossaryTerms} />
      );

      expect(container.querySelector('.tag-item')).not.toBeInTheDocument();
      expect(container.querySelectorAll('.glossary-term-item')).toHaveLength(3);
    });

    it('handles null or undefined description', () => {
      render(<FieldCard {...baseProps} description={undefined} />);

      expect(
        screen.getByText('label.no-entity - {"entity":"label.description"}')
      ).toBeInTheDocument();
    });

    it('handles empty string description', () => {
      render(<FieldCard {...baseProps} description="" />);

      expect(
        screen.getByText('label.no-entity - {"entity":"label.description"}')
      ).toBeInTheDocument();
    });

    it('handles special characters in field names', () => {
      const specialFieldName = 'field_name-with.special$chars';

      render(<FieldCard {...baseProps} fieldName={specialFieldName} />);

      expect(screen.getByText(specialFieldName)).toBeInTheDocument();
      expect(
        screen.getByTestId(`field-card-${specialFieldName}`)
      ).toBeInTheDocument();
    });

    it('correctly applies isHighlighted prop', () => {
      const { container: highlightedContainer } = render(
        <FieldCard {...baseProps} isHighlighted />
      );
      const { container: normalContainer } = render(
        <FieldCard {...baseProps} isHighlighted={false} />
      );

      expect(highlightedContainer.querySelector('.field-card')).toHaveClass(
        'field-card-highlighted'
      );
      expect(normalContainer.querySelector('.field-card')).not.toHaveClass(
        'field-card-highlighted'
      );
    });

    it('handles large number of tags efficiently', () => {
      const largeTags = Array.from({ length: 50 }, (_, i) => ({
        tagFQN: `Classification.Tag${i}`,
        name: `Tag${i}`,
        displayName: `Tag Display ${i}`,
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      }));

      const { container } = render(
        <FieldCard {...baseProps} tags={largeTags} />
      );

      const visibleTags = container.querySelectorAll('.tag-item');

      // In test environment with wide containers, all tags are shown
      expect(visibleTags).toHaveLength(50);
    });

    it('handles tags with different labelType values', () => {
      const tagsWithDifferentLabels = [
        {
          tagFQN: 'Classification.Manual',
          name: 'Manual',
          displayName: 'Manual Tag',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'Classification.Derived',
          name: 'Derived',
          displayName: 'Derived Tag',
          source: TagSource.Classification,
          labelType: LabelType.Derived,
          state: State.Confirmed,
        },
        {
          tagFQN: 'Classification.Automated',
          name: 'Automated',
          displayName: 'Automated Tag',
          source: TagSource.Classification,
          labelType: LabelType.Automated,
          state: State.Confirmed,
        },
      ];

      const { container } = render(
        <FieldCard {...baseProps} tags={tagsWithDifferentLabels} />
      );

      const tagItems = container.querySelectorAll('.tag-item');

      // In test environment with wide containers, all 3 tags are shown
      expect(tagItems).toHaveLength(3);
    });

    it('handles tags with different state values', () => {
      const tagsWithDifferentStates = [
        {
          tagFQN: 'Classification.Confirmed',
          name: 'Confirmed',
          displayName: 'Confirmed Tag',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'Classification.Suggested',
          name: 'Suggested',
          displayName: 'Suggested Tag',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Suggested,
        },
      ];

      const { container } = render(
        <FieldCard {...baseProps} tags={tagsWithDifferentStates} />
      );

      const tagItems = container.querySelectorAll('.tag-item');

      expect(tagItems).toHaveLength(2);
      expect(screen.getByText('Confirmed Tag')).toBeInTheDocument();
      expect(screen.getByText('Suggested Tag')).toBeInTheDocument();
    });
  });
});
