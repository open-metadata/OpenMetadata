/*
 *  Copyright 2024 Collate.
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
import TourEndModal from './TourEndModal';

const mockOnSave = jest.fn();

const mockProps = {
  onSave: mockOnSave,
  visible: true,
};

jest.mock('../../..//utils/BrandData/BrandClassBase', () => ({
  getMonogram: jest.fn(() => ({ src: 'mocked-logo.svg', svg: 'monogram-svg' })),
}));

describe('TourEndModal', () => {
  it('should render necessary elements', () => {
    render(<TourEndModal {...mockProps} />);

    expect(screen.getByTestId('modal-container')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.explore-now' }));

    expect(mockOnSave).toHaveBeenCalled();

    expect(screen.getByTestId('omd-logo')).toBeInTheDocument();
    expect(screen.getByTestId('tour-complete-message')).toBeInTheDocument();
  });

  it('should render with correct brandName keys', () => {
    render(<TourEndModal {...mockProps} />);

    const tourMessage = screen.getByTestId('tour-complete-message');

    expect(tourMessage).toBeInTheDocument();

    // Verify translation was called with brandName
    expect(
      screen.getByText(/message.get-started-with-open-metadata/)
    ).toBeInTheDocument();
  });
});
