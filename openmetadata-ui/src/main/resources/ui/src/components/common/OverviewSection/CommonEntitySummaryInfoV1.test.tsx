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
  Link: ({ to, children }: any) => (
    <a data-testid="internal-link" href={typeof to === 'string' ? to : '/'}>
      {children}
    </a>
  ),
}));

const defaultItems = [
  { name: 'Type', value: 'Table', visible: ['explore'] },
  { name: 'Rows', value: 1000, visible: ['explore'] },
  { name: 'Columns', value: 15, visible: ['explore'] },
];

describe('CommonEntitySummaryInfoV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders visible items for the given componentType', () => {
    const { container } = render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={defaultItems as any}
      />
    );

    expect(container.querySelector('.overview-section')).toBeInTheDocument();

    const rows = container.querySelectorAll('.overview-row');

    expect(rows).toHaveLength(3);

    expect(screen.getByTestId('Type-label')).toBeInTheDocument();
    expect(screen.getByTestId('Type-value')).toHaveTextContent('Table');
    expect(screen.getByTestId('Rows-label')).toBeInTheDocument();
    expect(screen.getByTestId('Rows-value')).toHaveTextContent('1000');
    expect(screen.getByTestId('Columns-label')).toBeInTheDocument();
    expect(screen.getByTestId('Columns-value')).toHaveTextContent('15');
  });

  it('filters out items not visible for the componentType', () => {
    const items = [
      { name: 'Visible', value: 'Yes', visible: ['explore'] },
      { name: 'Hidden', value: 'No', visible: ['other'] },
    ];

    render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={items as any}
      />
    );

    expect(screen.getByTestId('Visible-label')).toBeInTheDocument();
    expect(screen.queryByTestId('Hidden-label')).toBeNull();
  });

  it('shows domain item when isDomainVisible is true regardless of visibility array', () => {
    const items = [
      { name: 'label.domain-plural', value: 'Domain A', visible: ['other'] },
    ];

    render(
      <CommonEntitySummaryInfoV1
        isDomainVisible
        componentType="explore"
        entityInfo={items as any}
      />
    );

    expect(screen.getByTestId('label.domain-plural-label')).toBeInTheDocument();
    expect(screen.getByTestId('label.domain-plural-value')).toHaveTextContent(
      'Domain A'
    );
  });

  it('renders internal link when isLink is true and isExternal is false', () => {
    const items = [
      {
        name: 'Docs',
        value: 'OpenMetadata',
        isLink: true,
        isExternal: false,
        linkProps: '/docs',
        visible: ['explore'],
      },
    ];

    render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={items as any}
      />
    );

    const link = screen.getByTestId('internal-link');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/docs');
    expect(screen.getByTestId('Docs-value')).toHaveTextContent('OpenMetadata');
  });

  it('renders external link with icon when isExternal is true', () => {
    const items = [
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
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={items as any}
      />
    );

    const anchor = container.querySelector('a.summary-item-link');

    expect(anchor).toBeInTheDocument();
    expect(anchor).toHaveAttribute('href', 'https://open-metadata.org');
    expect(screen.getByTestId('external-link-icon')).toBeInTheDocument();
  });

  it('renders dash when value is null or undefined', () => {
    const items = [
      { name: 'Empty', value: undefined, visible: ['explore'] },
      { name: 'AlsoEmpty', value: null, visible: ['explore'] },
    ];

    const { getByTestId } = render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={items as any}
      />
    );

    expect(getByTestId('Empty-value')).toHaveTextContent('-');
    expect(getByTestId('AlsoEmpty-value')).toHaveTextContent('-');
  });

  it('supports labels with special characters in testids', () => {
    const items = [
      { name: 'Label & Value', value: 'Test', visible: ['explore'] },
      { name: 'Label < > " \'', value: 'Again', visible: ['explore'] },
    ];

    render(
      <CommonEntitySummaryInfoV1
        componentType="explore"
        entityInfo={items as any}
      />
    );

    expect(screen.getByTestId('Label & Value-value')).toHaveTextContent('Test');
    expect(screen.getByTestId('Label < > " \'-value')).toHaveTextContent(
      'Again'
    );
  });
});
