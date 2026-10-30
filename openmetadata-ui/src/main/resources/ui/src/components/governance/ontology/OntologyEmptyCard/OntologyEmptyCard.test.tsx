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
import { fireEvent, render, screen, within } from '@testing-library/react';
import OntologyEmptyCard from './OntologyEmptyCard';

describe('OntologyEmptyCard', () => {
  it('offers Add concept and reports the press', () => {
    const onAdd = jest.fn();
    render(<OntologyEmptyCard canAdd onAdd={onAdd} />);

    expect(screen.getByText('label.ontology-has-no-concepts')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-empty-card-add-concept'));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('frames the copy in a centred elevated card the canvas can pan around', () => {
    render(<OntologyEmptyCard canAdd onAdd={jest.fn()} />);
    const card = screen.getByTestId('ontology-empty-card');

    expect(card).toHaveClass('tw:shadow-md', 'tw:bg-surface', 'tw:w-85');
    expect(card).toHaveClass('tw:pointer-events-auto');
    expect(card.parentElement).toHaveClass(
      'tw:pointer-events-none',
      'tw:items-center',
      'tw:justify-center'
    );
  });

  it('renders the shared empty placeholder with a brand icon inside the card', () => {
    render(<OntologyEmptyCard canAdd onAdd={jest.fn()} />);
    const card = screen.getByTestId('ontology-empty-card');
    const placeholder = within(card).getByTestId('empty-placeholder');
    const icon = card.querySelector('[data-icon]');

    expect(placeholder).toBeVisible();
    expect(placeholder).toHaveClass('tw:static');
    expect(
      within(card).getByText('message.ontology-empty-card-description')
    ).toBeVisible();
    expect(icon?.parentElement).toHaveClass('tw:text-fg-brand-primary');
    [icon?.parentElement?.className, icon?.getAttribute('class')].forEach(
      (classes) => {
        expect(classes ?? '').not.toMatch(
          /gray|text-secondary|text-quaternary/
        );
      }
    );
  });

  it('hides Add concept from a user who cannot author the first class', () => {
    render(<OntologyEmptyCard canAdd={false} onAdd={jest.fn()} />);

    expect(screen.getByTestId('ontology-empty-card')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-empty-card-add-concept')
    ).not.toBeInTheDocument();
  });
});
