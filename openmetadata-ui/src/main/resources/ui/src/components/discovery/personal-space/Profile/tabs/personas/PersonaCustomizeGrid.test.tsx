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
import PersonaCustomizeGrid from './PersonaCustomizeGrid';

describe('PersonaCustomizeGrid', () => {
  it('renders a card for every customize category with its label', () => {
    render(<PersonaCustomizeGrid onSelectCategory={jest.fn()} />);

    const keys = screen
      .getAllByTestId(/^customize-card-/)
      .map((card) => card.dataset.testid);

    expect(keys).toEqual([
      'customize-card-navigation',
      'customize-card-app-layout',
      'customize-card-askCollateSidebar',
      'customize-card-LandingPage',
      'customize-card-DataMarketplace',
      'customize-card-governance',
      'customize-card-data-assets',
    ]);
    expect(screen.getByText('label.home-page')).toBeInTheDocument();
    expect(screen.getByText('label.governance')).toBeInTheDocument();
  });

  it('selects a category on click', () => {
    const onSelectCategory = jest.fn();
    render(<PersonaCustomizeGrid onSelectCategory={onSelectCategory} />);

    fireEvent.click(screen.getByTestId('customize-card-governance'));

    expect(onSelectCategory).toHaveBeenCalledWith('governance');
  });

  it('selects a category with Enter and Space but ignores other keys', () => {
    const onSelectCategory = jest.fn();
    render(<PersonaCustomizeGrid onSelectCategory={onSelectCategory} />);
    const card = screen.getByTestId('customize-card-LandingPage');

    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'Tab' });

    expect(onSelectCategory).toHaveBeenCalledTimes(2);
    expect(onSelectCategory).toHaveBeenCalledWith('LandingPage');
  });
});
