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
import { act, render, screen } from '@testing-library/react';
import { useProductTourStore } from '../../hooks/useProductTourStore';
import ProductTour from './ProductTour';

jest.mock('./ProductTourModal', () => ({
  __esModule: true,
  default: () => <div data-testid="product-tour-modal" />,
}));

describe('ProductTour', () => {
  afterEach(() => {
    act(() => useProductTourStore.getState().close());
  });

  it('renders nothing while the tour is closed', () => {
    render(<ProductTour />);

    expect(screen.queryByTestId('product-tour-modal')).not.toBeInTheDocument();
  });

  it('loads and shows the tour modal once the tour opens', async () => {
    render(<ProductTour />);

    act(() => useProductTourStore.getState().open());

    expect(await screen.findByTestId('product-tour-modal')).toBeInTheDocument();
  });
});
