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
import CommonEntitySummaryInfoV1 from './CommonEntitySummaryInfoV1';
import { EntityInfoItemV1 } from './CommonEntitySummaryInfoV1.interface';

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

// Mock Icon component from antd icons to avoid SVG/render issues
jest.mock('@ant-design/icons/lib/components/Icon', () => {
  return jest
    .fn()
    .mockImplementation((props: any) => (
      <span data-testid={props['data-testid'] || 'icon'} />
    ));
});

// Mock Link from react-router-dom to avoid Router dependency
jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ to, children, onClick }: any) => (
    <a
      data-testid="internal-link"
      href={typeof to === 'string' ? to : '/'}
      onClick={onClick}>
      {children}
    </a>
  )),
}));

const defaultItems: EntityInfoItemV1[] = [
  { name: 'Type', value: 'Table', visible: ['explore'] },
  { name: 'Rows', value: 1000, visible: ['explore'] },
  { name: 'Columns', value: 15, visible: ['explore'] },
];

describe('CommonEntitySummaryInfoV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders no data placeholder when entityInfo is empty', () => {
    render(
      <CommonEntitySummaryInfoV1 componentType="explore" entityInfo={[]} />
    );

    expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument();
  });

  it('renders visible items for the given componentType', () => {
    render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={defaultItems}
      />
    );

    expect(screen.getByTestId('Type-label')).toBeInTheDocument();
    expect(screen.getByTestId('Type-value')).toHaveTextContent('Table');
    expect(screen.getByTestId('Rows-label')).toBeInTheDocument();
    expect(screen.getByTestId('Rows-value')).toHaveTextContent('1000');
    expect(screen.getByTestId('Columns-label')).toBeInTheDocument();
    expect(screen.getByTestId('Columns-value')).toHaveTextContent('15');
  });

  it('filters out items not visible for the componentType', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'Visible', value: 'Yes', visible: ['explore'] },
      { name: 'Hidden', value: 'No', visible: ['other'] },
    ];

    render(
      <CommonEntitySummaryInfoV1 componentType="explore" entityInfo={items} />
    );

    expect(screen.getByTestId('Visible-label')).toBeInTheDocument();
    expect(screen.queryByTestId('Hidden-label')).toBeNull();
  });

  it('shows domain item when isDomainVisible is true regardless of visibility array', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'label.domain-plural', value: 'Domain A', visible: ['other'] },
    ];

    render(
      <CommonEntitySummaryInfoV1
        isDomainVisible
        componentType="explore"
        entityInfo={items}
      />
    );

    expect(screen.getByTestId('label.domain-plural-label')).toBeInTheDocument();
    expect(screen.getByTestId('label.domain-plural-value')).toHaveTextContent(
      'Domain A'
    );
  });

  it('renders internal link when isLink is true and isExternal is false', () => {
    const items: EntityInfoItemV1[] = [
      {
        name: 'Docs',
        value: 'OpenMetadata',
        isLink: true,
        isExternal: false,
        linkProps: '/docs',
        visible: ['explore'],
      },
    ];

    const { container } = render(
      <CommonEntitySummaryInfoV1 componentType="explore" entityInfo={items} />
    );

    const link =
      screen.queryByTestId('internal-link') ||
      container.querySelector('[to="/docs"]');

    expect(link).toBeInTheDocument();
    expect(screen.getByTestId('Docs-value')).toHaveTextContent('OpenMetadata');
  });

  it('renders external link with icon when isExternal is true', () => {
    const items: EntityInfoItemV1[] = [
      {
        name: 'Website',
        value: 'OpenMetadata',
        isLink: true,
        isExternal: true,
        url: 'https://open-metadata.org',
        visible: ['explore'],
      },
    ];

    const { container } = render(
      <CommonEntitySummaryInfoV1 componentType="explore" entityInfo={items} />
    );

    const anchor = container.querySelector(
      '[href="https://open-metadata.org"]'
    );

    expect(anchor).toBeInTheDocument();
    expect(screen.getByTestId('external-link-icon')).toBeInTheDocument();
    expect(screen.getByTestId('Website-value')).toHaveTextContent(
      'OpenMetadata'
    );
  });

  it('renders dash when value is null or undefined', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'Empty', value: undefined, visible: ['explore'] },
      { name: 'AlsoEmpty', value: null, visible: ['explore'] },
    ];

    const { getByTestId } = render(
      <CommonEntitySummaryInfoV1 componentType="explore" entityInfo={items} />
    );

    expect(getByTestId('Empty-value')).toHaveTextContent('-');
    expect(getByTestId('AlsoEmpty-value')).toHaveTextContent('-');
  });

  it('supports labels with special characters in testids', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'Label & Value', value: 'Test', visible: ['explore'] },
      { name: 'Label < > " \'', value: 'Again', visible: ['explore'] },
    ];

    render(
      <CommonEntitySummaryInfoV1 componentType="explore" entityInfo={items} />
    );

    expect(screen.getByTestId('Label & Value-value')).toHaveTextContent('Test');
    expect(screen.getByTestId('Label < > " \'-value')).toHaveTextContent(
      'Again'
    );
  });

  it('excludes items specified in excludedItems prop', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'Type', value: 'Table', visible: ['explore'] },
      { name: 'Owners', value: 'John Doe', visible: ['explore'] },
      { name: 'Tier', value: 'Gold', visible: ['explore'] },
      { name: 'Rows', value: 1000, visible: ['explore'] },
    ];

    render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={items}
        excludedItems={['Owners', 'Tier']}
      />
    );

    expect(screen.getByTestId('Type-label')).toBeInTheDocument();
    expect(screen.getByTestId('Rows-label')).toBeInTheDocument();
    expect(screen.queryByTestId('Owners-label')).toBeNull();
    expect(screen.queryByTestId('Tier-label')).toBeNull();
  });

  it('renders all items when excludedItems is empty array', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'Type', value: 'Table', visible: ['explore'] },
      { name: 'Owners', value: 'John Doe', visible: ['explore'] },
    ];

    render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={items}
        excludedItems={[]}
      />
    );

    expect(screen.getByTestId('Type-label')).toBeInTheDocument();
    expect(screen.getByTestId('Owners-label')).toBeInTheDocument();
  });

  it('renders all items when excludedItems is not provided', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'Type', value: 'Table', visible: ['explore'] },
      { name: 'Owners', value: 'John Doe', visible: ['explore'] },
    ];

    render(
      <CommonEntitySummaryInfoV1 componentType="explore" entityInfo={items} />
    );

    expect(screen.getByTestId('Type-label')).toBeInTheDocument();
    expect(screen.getByTestId('Owners-label')).toBeInTheDocument();
  });

  it('combines excludedItems with visibility filtering', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'Type', value: 'Table', visible: ['explore'] },
      { name: 'Owners', value: 'John Doe', visible: ['explore'] },
      { name: 'Hidden', value: 'Secret', visible: ['other'] },
      { name: 'Tier', value: 'Gold', visible: ['explore'] },
    ];

    render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={items}
        excludedItems={['Owners', 'Tier']}
      />
    );

    expect(screen.getByTestId('Type-label')).toBeInTheDocument();
    expect(screen.queryByTestId('Owners-label')).toBeNull();
    expect(screen.queryByTestId('Hidden-label')).toBeNull();
    expect(screen.queryByTestId('Tier-label')).toBeNull();
  });

  it('shows domain item when isDomainVisible is true even if in excludedItems', () => {
    const items: EntityInfoItemV1[] = [
      { name: 'Type', value: 'Table', visible: ['explore'] },
      { name: 'label.domain-plural', value: 'Domain A', visible: ['other'] },
    ];

    render(
      <CommonEntitySummaryInfoV1
        isDomainVisible
        componentType="explore"
        entityInfo={items}
        excludedItems={['label.domain-plural']}
      />
    );

    expect(screen.getByTestId('Type-label')).toBeInTheDocument();
    expect(screen.queryByTestId('label.domain-plural-label')).toBeNull();
  });

  describe('when componentType is empty string', () => {
    it('shows items without visible field when componentType is empty', () => {
      const items: EntityInfoItemV1[] = [
        { name: 'Source', value: 'Table A' },
        { name: 'Target', value: 'Table B' },
        { name: 'Edge', value: 'Pipeline', isLink: true },
      ];

      render(<CommonEntitySummaryInfoV1 componentType="" entityInfo={items} />);

      expect(screen.getByTestId('Source-label')).toBeInTheDocument();
      expect(screen.getByTestId('Source-value')).toHaveTextContent('Table A');
      expect(screen.getByTestId('Target-label')).toBeInTheDocument();
      expect(screen.getByTestId('Target-value')).toHaveTextContent('Table B');
      expect(screen.getByTestId('Edge-label')).toBeInTheDocument();
      expect(screen.getByTestId('Edge-value')).toHaveTextContent('Pipeline');
    });

    it('shows items with empty visible array when componentType is empty', () => {
      const items: EntityInfoItemV1[] = [
        { name: 'Source', value: 'Table A', visible: [] },
        { name: 'Target', value: 'Table B', visible: [] },
      ];

      render(<CommonEntitySummaryInfoV1 componentType="" entityInfo={items} />);

      expect(screen.getByTestId('Source-label')).toBeInTheDocument();
      expect(screen.getByTestId('Target-label')).toBeInTheDocument();
    });

    it('still filters items with visible field when componentType is empty', () => {
      const items: EntityInfoItemV1[] = [
        { name: 'NoVisible', value: 'Table A' },
        { name: 'WithVisible', value: 'Table B', visible: ['explore'] },
        { name: 'WithOtherVisible', value: 'Table C', visible: ['other'] },
      ];

      render(<CommonEntitySummaryInfoV1 componentType="" entityInfo={items} />);

      // Item without visible field should be shown
      expect(screen.getByTestId('NoVisible-label')).toBeInTheDocument();

      // Items with visible field should be filtered (empty string not in their visible array)
      expect(screen.queryByTestId('WithVisible-label')).toBeNull();
      expect(screen.queryByTestId('WithOtherVisible-label')).toBeNull();
    });

    it('shows items without visible field mixed with items that have visible field containing empty string', () => {
      const items: EntityInfoItemV1[] = [
        { name: 'NoVisible', value: 'Table A' },
        { name: 'WithEmptyVisible', value: 'Table B', visible: [''] },
        { name: 'WithOtherVisible', value: 'Table C', visible: ['explore'] },
      ];

      render(<CommonEntitySummaryInfoV1 componentType="" entityInfo={items} />);

      expect(screen.getByTestId('NoVisible-label')).toBeInTheDocument();
      expect(screen.getByTestId('WithEmptyVisible-label')).toBeInTheDocument();
      expect(screen.queryByTestId('WithOtherVisible-label')).toBeNull();
    });
  });
});
