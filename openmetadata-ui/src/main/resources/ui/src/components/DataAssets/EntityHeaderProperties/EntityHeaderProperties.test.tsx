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
import EntityHeaderProperties from './EntityHeaderProperties';
import { HeaderProperty } from './EntityHeaderProperties.types';

const property = (
  id: string,
  overrides: Partial<HeaderProperty> = {}
): HeaderProperty => ({
  id,
  label: `${id}-label`,
  isEmpty: false,
  isReadOnly: true,
  content: <span>{`${id}-value`}</span>,
  ...overrides,
});

const properties = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((id) =>
  property(id)
);

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

    expect(shownIds()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);

    const toggle = screen.getByTestId('header-properties-toggle');

    expect(toggle).toHaveTextContent('label.show-count-more');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(shownIds()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
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
          property('p1', { isEmpty: true }),
          property('p2', { isEmpty: true, isReadOnly: false }),
          property('p3'),
        ]}
      />
    );

    expect(shownIds()).toEqual(['p2', 'p3']);
  });
});
