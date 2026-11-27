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
import { HeaderPropertyId } from '../../../constants/EntityHeaderProperties.constants';
import EntityHeaderProperties from './EntityHeaderProperties';
import { HeaderProperty } from './EntityHeaderProperties.types';

const property = (
  id: HeaderPropertyId,
  overrides: Partial<HeaderProperty> = {}
): HeaderProperty => ({
  id,
  label: `${id}-label`,
  isEmpty: false,
  isReadOnly: true,
  content: <span>{`${id}-value`}</span>,
  ...overrides,
});

const properties = Object.values(HeaderPropertyId)
  .slice(0, 7)
  .map((id) => property(id));

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const shownIds = () =>
  screen
    .getAllByTestId(/^header-property-(?!toggle)/)
    .map((element) =>
      element.getAttribute('data-testid')?.replace('header-property-', '')
    );

describe('EntityHeaderProperties', () => {
  it('shows the first five properties and the rest behind Show more', async () => {
    render(<EntityHeaderProperties properties={properties} />);

    expect(shownIds()).toEqual([
      'domains',
      'owners',
      'tier',
      'certification',
      'retentionPeriod',
    ]);

    const toggle = screen.getByTestId('header-properties-toggle');

    expect(toggle).toHaveTextContent('label.show-count-more');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(shownIds()).toEqual([
      'domains',
      'owners',
      'tier',
      'certification',
      'retentionPeriod',
      'type',
      'usage',
    ]);
    expect(toggle).toHaveTextContent('label.show-less');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no Show more when every property fits', () => {
    render(<EntityHeaderProperties properties={properties.slice(0, 5)} />);

    expect(shownIds()).toHaveLength(5);
    expect(
      screen.queryByTestId('header-properties-toggle')
    ).not.toBeInTheDocument();
  });

  it('hides an empty read-only property and keeps an empty editable one', () => {
    render(
      <EntityHeaderProperties
        properties={[
          property(HeaderPropertyId.Domains, { isEmpty: true }),
          property(HeaderPropertyId.Owners, {
            isEmpty: true,
            isReadOnly: false,
          }),
          property(HeaderPropertyId.Tier),
        ]}
      />
    );

    expect(shownIds()).toEqual(['owners', 'tier']);
  });
});
