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

import { fireEvent, render, screen } from '@testing-library/react';
import SubCategoryGrid from './SubCategoryGrid';

describe('SubCategoryGrid', () => {
  it('renders a card per governance entity type', () => {
    render(
      <SubCategoryGrid baseCategory="governance" onSelectEntity={jest.fn()} />
    );

    const cards = screen.getAllByTestId(/^sub-category-card-/);

    expect(cards.map((card) => card.dataset.testid)).toEqual(
      expect.arrayContaining([
        'sub-category-card-Domain',
        'sub-category-card-Glossary',
        'sub-category-card-GlossaryTerm',
        'sub-category-card-DataProduct',
      ])
    );
    expect(cards).toHaveLength(4);
    expect(screen.getByText('Domain')).toBeInTheDocument();
  });

  it('renders data asset entity types but not governance or home page ones', () => {
    render(
      <SubCategoryGrid baseCategory="data-assets" onSelectEntity={jest.fn()} />
    );

    expect(screen.getByTestId('sub-category-card-Table')).toBeInTheDocument();
    expect(
      screen.queryByTestId('sub-category-card-Domain')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('sub-category-card-LandingPage')
    ).not.toBeInTheDocument();
  });

  it('renders an empty grid for a category without sub options', () => {
    render(
      <SubCategoryGrid baseCategory="navigation" onSelectEntity={jest.fn()} />
    );

    expect(
      screen.getByTestId('persona-sub-category-grid')
    ).toBeEmptyDOMElement();
  });

  it('selects the entity on click', () => {
    const onSelectEntity = jest.fn();
    render(
      <SubCategoryGrid
        baseCategory="governance"
        onSelectEntity={onSelectEntity}
      />
    );

    fireEvent.click(screen.getByTestId('sub-category-card-Domain'));

    expect(onSelectEntity).toHaveBeenCalledWith('Domain');
  });

  it('selects the entity with Enter and Space but ignores other keys', () => {
    const onSelectEntity = jest.fn();
    render(
      <SubCategoryGrid
        baseCategory="governance"
        onSelectEntity={onSelectEntity}
      />
    );
    const card = screen.getByTestId('sub-category-card-Glossary');

    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'a' });

    expect(onSelectEntity).toHaveBeenCalledTimes(2);
    expect(onSelectEntity).toHaveBeenNthCalledWith(1, 'Glossary');
    expect(onSelectEntity).toHaveBeenNthCalledWith(2, 'Glossary');
  });
});
