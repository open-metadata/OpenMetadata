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
import { render, screen, within } from '@testing-library/react';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { CustomPropertyVersionList } from './CustomPropertyVersionList';

jest.mock('../../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(
      ({ markdown, className }: { markdown: string; className?: string }) => (
        <div className={className} data-testid="rich-text-previewer">
          {markdown}
        </div>
      )
    )
);

const createProperty = (name: string, typeName: string): CustomProperty => ({
  name,
  displayName: name,
  description: '',
  propertyType: { id: `${typeName}-id`, name: typeName, type: 'type' },
});

const properties = [
  createProperty('owner', 'string'),
  createProperty('tiers', 'enum'),
  createProperty('docs', 'hyperlink-cp'),
  createProperty('cost', 'integer'),
];

const getValue = (propertyName: string) =>
  within(screen.getByTestId(`custom-property-${propertyName}-row`)).getByTestId(
    'property-value'
  );

describe('CustomPropertyVersionList', () => {
  it('renders every property as a read-only row', () => {
    render(
      <CustomPropertyVersionList
        extension={{ owner: 'Data Platform' }}
        properties={properties}
      />
    );

    expect(screen.getByTestId('custom-properties-card')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
  });

  it('renders string values, including diff markup, through the previewer', () => {
    render(
      <CustomPropertyVersionList
        extension={{
          owner: 'Data Platform',
          docs: '<span class="diff-added">https://docs.example.com</span>',
        }}
        properties={properties}
      />
    );

    expect(getValue('owner')).toHaveTextContent('Data Platform');
    // A hyperlink diff is a string, not a { url } object: it must still
    // render instead of reading as "not set".
    expect(
      within(getValue('docs')).getByTestId('rich-text-previewer')
    ).toHaveTextContent('https://docs.example.com');
  });

  it('summarises structured values and marks added properties', () => {
    render(
      <CustomPropertyVersionList
        addedKeys={['tiers']}
        extension={{ tiers: ['gold', 'silver'] }}
        properties={properties}
      />
    );

    const tiers = getValue('tiers');

    expect(tiers).toHaveTextContent('gold, silver');
    expect(within(tiers).getByText('gold, silver')).toHaveClass('diff-added');
  });

  it('shows "not set" for properties without a value', () => {
    render(<CustomPropertyVersionList properties={properties} />);

    expect(getValue('cost')).toHaveTextContent('label.not-set');
  });
});
