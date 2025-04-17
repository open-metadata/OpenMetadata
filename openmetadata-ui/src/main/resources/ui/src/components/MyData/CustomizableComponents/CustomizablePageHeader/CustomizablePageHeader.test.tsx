/*
 *  Copyright 2025 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { PageType } from '../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import { CustomizablePageHeader } from './CustomizablePageHeader';

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'test-persona' }),
}));

jest.mock('../../../../pages/CustomizablePage/CustomizeStore');

describe('CustomizablePageHeader', () => {
  const mockProps = {
    onSave: jest.fn().mockResolvedValue(undefined),
    onReset: jest.fn(),
    personaName: 'Test Persona',
  };

  beforeEach(() => {
    (useCustomizeStore as unknown as jest.Mock).mockReturnValue({
      currentPageType: PageType.LandingPage,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the header with correct title and persona info', () => {
    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('customize-page-title')).toBeInTheDocument();
    expect(screen.getByText('label.customize-entity')).toBeInTheDocument();
  });

  it('should render all buttons in the header', () => {
    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('reset-button')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('should handle save button click', async () => {
    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    const saveButton = screen.getByTestId('save-button');
    fireEvent.click(saveButton);

    expect(mockProps.onSave).toHaveBeenCalled();

    // Wait for the saving state to complete
    await waitFor(() => {
      expect(saveButton).not.toHaveAttribute('loading');
    });
  });

  it('should disable buttons while saving', async () => {
    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    const saveButton = screen.getByTestId('save-button');
    fireEvent.click(saveButton);

    // Check if cancel and reset buttons are disabled during save
    expect(screen.getByTestId('cancel-button')).toBeDisabled();
    expect(screen.getByTestId('reset-button')).toBeDisabled();

    await waitFor(() => {
      expect(saveButton).not.toHaveAttribute('loading');
    });
  });

  it('should show reset confirmation modal when reset button is clicked', () => {
    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('reset-button'));

    expect(screen.getByTestId('reset-layout-modal')).toBeInTheDocument();
    expect(
      screen.getByText('message.reset-layout-confirmation')
    ).toBeInTheDocument();
  });

  it('should handle reset confirmation', () => {
    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    // Open reset modal
    fireEvent.click(screen.getByTestId('reset-button'));

    // Click yes on the modal
    const modal = screen.getByTestId('reset-layout-modal');
    const okButton = modal.querySelector('.ant-btn-primary') as HTMLElement;
    fireEvent.click(okButton);

    expect(mockProps.onReset).toHaveBeenCalled();
    expect(screen.queryByTestId('reset-layout-modal')).not.toBeInTheDocument();
  });

  it('should handle reset cancellation', () => {
    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    // Open reset modal
    fireEvent.click(screen.getByTestId('reset-button'));

    // Click no on the modal
    const modal = screen.getByTestId('reset-layout-modal');
    const cancelButton = modal.querySelector(
      '.ant-btn:not(.ant-btn-primary)'
    ) as HTMLElement;
    fireEvent.click(cancelButton);

    expect(mockProps.onReset).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reset-layout-modal')).not.toBeInTheDocument();
  });

  it('should render different titles for different page types', () => {
    const translation = jest.spyOn(useTranslation(), 't');
    (useCustomizeStore as unknown as jest.Mock).mockReturnValue({
      currentPageType: PageType.LandingPage,
    });

    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    expect(translation).toHaveBeenCalledWith('label.customize-entity', {
      entity: 'label.landing-page',
    });
  });

  it('should handle navigation link to persona details', () => {
    render(
      <MemoryRouter>
        <CustomizablePageHeader {...mockProps} />
      </MemoryRouter>
    );

    const personaLink = screen.getByRole('link');

    expect(personaLink).toHaveAttribute(
      'href',
      '/settings/persona/test-persona'
    );
  });
});
