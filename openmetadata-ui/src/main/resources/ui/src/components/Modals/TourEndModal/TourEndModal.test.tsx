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
import * as reactI18next from 'react-i18next';
import TourEndModal from './TourEndModal';

jest.mock('../../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getPageTitle: jest.fn().mockReturnValue('OpenMetadata'),
  },
}));

const mockOnSave = jest.fn();

const mockProps = {
  onSave: mockOnSave,
  visible: true,
};

describe('TourEndModal', () => {
  it('should render necessary elements', () => {
    render(<TourEndModal {...mockProps} />);

    expect(screen.getByTestId('modal-container')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.explore-now' }));

    expect(mockOnSave).toHaveBeenCalled();

    expect(screen.getByTestId('omd-logo')).toBeInTheDocument();
    expect(screen.getByTestId('tour-complete-message')).toBeInTheDocument();
  });

  it('should render with correct brandName (OpenMetadata or Collate)', () => {
    const mockT = jest.fn((key: string, params?: Record<string, string>) => {
      if (
        key === 'message.get-started-with-open-metadata' &&
        params?.brandName
      ) {
        return `Get started with ${params.brandName} today!`;
      }

      return key;
    });

    jest.spyOn(reactI18next, 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { language: 'en-US' },
      ready: true,
    } as any);

    render(<TourEndModal {...mockProps} />);

    const tourMessage = screen.getByTestId('tour-complete-message');

    expect(tourMessage).toBeInTheDocument();
    // Verify actual brand name is rendered
    expect(tourMessage.textContent).toMatch(/OpenMetadata|Collate/);
    expect(tourMessage.textContent).not.toContain('{{brandName}}');

    // Verify translation was called with brandName
    expect(mockT).toHaveBeenCalledWith(
      'message.get-started-with-open-metadata',
      {
        brandName: 'OpenMetadata',
      }
    );
  });
});
