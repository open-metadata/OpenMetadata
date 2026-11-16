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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { CustomPropertyCardList } from './CustomPropertyCardList';

jest.mock('../../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }: { markdown: string }) => (
      <div>{markdown}</div>
    ))
);

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const createProperty = (
  name: string,
  typeName: string,
  displayName?: string
): CustomProperty => ({
  name,
  displayName,
  description: `${name} description`,
  propertyType: { id: `${typeName}-id`, name: typeName, type: 'type' },
});

const properties = [
  createProperty('zeta', 'string', 'Zeta'),
  createProperty('alpha', 'markdown', 'Alpha'),
  createProperty('beta', 'enum', 'Beta'),
];

const getRenderedNames = () =>
  screen.getAllByTestId('property-name').map((node) => node.textContent);

const renderList = () =>
  render(
    <CustomPropertyCardList
      hasEditPermissions
      extension={{ zeta: 'value' }}
      properties={properties}
      onValueSave={jest.fn()}
    />
  );

describe('CustomPropertyCardList', () => {
  it('renders one card per property, sorted by name', () => {
    renderList();

    expect(getRenderedNames()).toEqual(['Beta', 'Zeta', 'Alpha']);
  });

  it('spans block-type properties across both columns', () => {
    renderList();

    expect(
      screen.getByTestId('custom-property-alpha-card').parentElement
    ).toHaveClass('tw:lg:col-span-2');
    expect(
      screen.getByTestId('custom-property-beta-card').parentElement
    ).not.toHaveClass('tw:lg:col-span-2');
  });

  it('filters by search text', async () => {
    renderList();

    await user.type(screen.getByTestId('custom-property-search'), 'zeta');

    expect(getRenderedNames()).toEqual(['Zeta']);
  });

  it('shows a message when nothing matches', async () => {
    renderList();

    await user.type(screen.getByTestId('custom-property-search'), 'missing');

    expect(
      screen.getByTestId('no-matching-custom-properties')
    ).toBeInTheDocument();
  });

  it('sorts properties with a value first', async () => {
    renderList();

    await user.click(screen.getByTestId('custom-property-sort'));
    await user.click(
      screen.getByRole('menuitemradio', { name: 'label.with-value-first' })
    );

    expect(getRenderedNames()).toEqual(['Zeta', 'Beta', 'Alpha']);
  });
});
