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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useProductTourStore } from '../../hooks/useProductTourStore';
import ProductTourModal from './ProductTourModal';

jest.mock('../../utils/ProductTourClassBase', () => ({
  __esModule: true,
  default: { getTourUrl: () => 'https://example.storylane.io/demo/tour' },
}));

describe('ProductTourModal', () => {
  beforeEach(() => {
    act(() => useProductTourStore.getState().open());
  });

  afterEach(() => {
    act(() => useProductTourStore.getState().close());
  });

  it("shows the distribution's demo in a dialog titled after the tour", () => {
    render(<ProductTourModal />);

    const dialog = screen.getByTestId('product-tour-dialog');

    expect(dialog).toHaveAttribute('aria-label', 'label.product-tour');
    expect(screen.getByTitle('label.product-tour')).toHaveAttribute(
      'src',
      'https://example.storylane.io/demo/tour'
    );
  });

  it('closes the tour from its close button', () => {
    render(<ProductTourModal />);

    fireEvent.click(screen.getByTestId('close-product-tour'));

    expect(useProductTourStore.getState().isOpen).toBe(false);
  });

  it('opens full screen and switches to a popup and back', () => {
    render(<ProductTourModal />);
    const frame = () =>
      screen
        .getByTitle('label.product-tour')
        .closest('.storylane-tour-wrapper');

    expect(frame()).toHaveClass('storylane-tour-wrapper--fill');

    fireEvent.click(screen.getByTestId('minimize-button'));

    expect(frame()).not.toHaveClass('storylane-tour-wrapper--fill');
    expect(screen.getByTestId('maximize-button')).toHaveAttribute(
      'aria-label',
      'label.fullscreen'
    );

    fireEvent.click(screen.getByTestId('maximize-button'));

    expect(frame()).toHaveClass('storylane-tour-wrapper--fill');
    expect(useProductTourStore.getState().isOpen).toBe(true);
  });

  it('closes the tour on Escape', () => {
    render(<ProductTourModal />);

    fireEvent.keyDown(screen.getByTestId('product-tour-dialog'), {
      key: 'Escape',
    });

    expect(useProductTourStore.getState().isOpen).toBe(false);
  });
});
