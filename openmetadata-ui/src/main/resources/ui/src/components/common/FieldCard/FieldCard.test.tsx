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
import { TagSource } from '../../../generated/tests/testCase';
import FieldCard from './FieldCard';

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: any) => {
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

const { getDataTypeString, prepareConstraintIcon } = jest.requireMock(
  '../../../utils/TableUtils'
);

const baseProps = {
  fieldName: 'customer_id',
  dataType: 'varchar',
  description: 'Field description',
  tags: [
    {
      tagFQN: 'Classification.PII.Sensitive',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
    {
      tagFQN: 'Glossary.Customer',
      source: TagSource.Glossary,
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  columnConstraint: 'PRIMARY_KEY',
  tableConstraints: [
    { constraintType: 'PRIMARY_KEY', columns: ['customer_id'] },
  ],
};

describe('FieldCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders basic structure and content', () => {
    const { container } = render(<FieldCard {...(baseProps as any)} />);

    expect(container.querySelector('.field-card')).toBeInTheDocument();
    expect(container.querySelector('.field-card-header')).toBeInTheDocument();
    expect(container.querySelector('.field-card-content')).toBeInTheDocument();

    expect(screen.getByText('customer_id')).toBeInTheDocument();
    expect(screen.getByTestId('rte-previewer')).toHaveTextContent(
      'Field description'
    );
  });

  it('renders data type badge using utility', () => {
    render(<FieldCard {...(baseProps as any)} />);

    expect(getDataTypeString).toHaveBeenCalled();
    expect(screen.getByText(/^DT:/)).toBeInTheDocument();
  });

  it('renders constraint icon when columnConstraint provided', () => {
    render(<FieldCard {...(baseProps as any)} />);

    expect(prepareConstraintIcon).toHaveBeenCalledWith(
      expect.objectContaining({ columnName: 'customer_id' })
    );
    expect(screen.getByTestId('constraint-icon')).toBeInTheDocument();
  });

  it('shows no-description text when description is missing', () => {
    render(<FieldCard {...(baseProps as any)} description={undefined} />);

    expect(
      screen.getByText('label.no-entity - {"entity":"label.description"}')
    ).toBeInTheDocument();
  });

  it('shows tags and glossary counts in metadata', () => {
    const { container } = render(<FieldCard {...(baseProps as any)} />);

    const items = container.querySelectorAll('.metadata-item');

    expect(items.length).toBeGreaterThan(0);

    expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(screen.getByText('label.glossary-term-plural')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('omits metadata sections when no tags or glossary terms', () => {
    const { container } = render(
      <FieldCard {...(baseProps as any)} tags={[]} />
    );

    expect(container.querySelector('.metadata-item')).toBeNull();
  });

  it('applies highlighted class when isHighlighted is true', () => {
    const { container } = render(
      <FieldCard {...(baseProps as any)} isHighlighted />
    );

    expect(container.querySelector('.field-card')).toHaveClass(
      'field-card-highlighted'
    );
  });
});
