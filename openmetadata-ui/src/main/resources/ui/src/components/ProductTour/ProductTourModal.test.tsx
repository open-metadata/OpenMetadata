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
import { ResourcePlayerModal } from '../Learning/ResourcePlayer/ResourcePlayerModal.component';
import ProductTourModal from './ProductTourModal';

jest.mock('../Learning/ResourcePlayer/ResourcePlayerModal.component', () => ({
  ResourcePlayerModal: jest.fn().mockImplementation(({ onClose }) => (
    <button data-testid="tour-player" onClick={onClose}>
      tour
    </button>
  )),
}));

jest.mock('../../utils/ProductTourClassBase', () => ({
  __esModule: true,
  default: { getTourUrl: () => 'https://example.storylane.io/demo/tour' },
}));

describe('ProductTourModal', () => {
  afterEach(() => {
    act(() => useProductTourStore.getState().close());
  });

  it('renders nothing until the tour is opened', () => {
    render(<ProductTourModal />);

    expect(screen.queryByTestId('tour-player')).not.toBeInTheDocument();
  });

  it("opens the distribution's demo full screen, without fetching it", () => {
    act(() => useProductTourStore.getState().open());
    render(<ProductTourModal />);

    expect(ResourcePlayerModal).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        isFullScreenByDefault: true,
        isStored: false,
        resource: expect.objectContaining({
          displayName: 'label.product-tour',
          resourceType: 'Storylane',
          source: { url: 'https://example.storylane.io/demo/tour' },
        }),
      }),
      {}
    );
  });

  it('closes the tour when the player closes', () => {
    act(() => useProductTourStore.getState().open());
    render(<ProductTourModal />);

    act(() => screen.getByTestId('tour-player').click());

    expect(useProductTourStore.getState().isOpen).toBe(false);
    expect(screen.queryByTestId('tour-player')).not.toBeInTheDocument();
  });
});
