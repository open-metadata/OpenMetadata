/*
 *  Copyright 2022 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import * as CommonUtils from '../../../utils/CommonUtils';
import EntityDeleteModal from './EntityDeleteModal';

const onCancel = jest.fn();
const onConfirm = jest.fn();

const mockProp = {
  loadingState: 'initial',
  entityName: 'zyx',
  entityType: 'table',
  onCancel,
  onConfirm,
  visible: false,
};

jest.mock('../../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getPageTitle: jest.fn().mockReturnValue('OpenMetadata'),
  },
}));

jest.mock('react-i18next', () => ({
  Trans: jest.fn().mockImplementation(() => <div>Trans</div>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('Test EntityDelete Modal Component', () => {
  it('Should render component', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />);
    });

    expect(
      await screen.findByTestId('delete-confirmation-modal')
    ).toBeInTheDocument();

    expect(await screen.findByTestId('modal-header')).toBeInTheDocument();

    expect(await screen.findByTestId('body-text')).toBeInTheDocument();

    expect(
      await screen.findByTestId('confirmation-text-input')
    ).toBeInTheDocument();
  });

  it('Should initially render confirm button as disable', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />, {
        wrapper: MemoryRouter,
      });
    });

    const confirmButton = await screen.findByTestId('confirm-button');

    expect(confirmButton).toBeDisabled();
  });

  it('Confirm button should be enable if confirm text matches', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />, {
        wrapper: MemoryRouter,
      });
    });

    const confirmButton = await screen.findByTestId('confirm-button');

    expect(confirmButton).toBeDisabled();

    const inputBox = await screen.findByTestId('confirmation-text-input');

    fireEvent.change(inputBox, {
      target: { value: 'DELETE' },
    });

    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalled();
  });

  it('Should call onCancel on click of discard button', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />, {
        wrapper: MemoryRouter,
      });
    });

    const discardButton = await screen.findByTestId('discard-button');

    fireEvent.click(discardButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should show soft delete label in case of soft delete', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} softDelete visible />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText('label.soft-delete')).toBeInTheDocument();
  });

  it('should focus the input box on open', async () => {
    // since the focus is set using setTimeout, we need to use fake timers
    jest.useFakeTimers();
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />, {
        wrapper: MemoryRouter,
      });
    });

    jest.runOnlyPendingTimers();

    const inputBox = await screen.findByTestId('confirmation-text-input');

    // Check if element is focused
    expect(inputBox).toHaveFocus();

    jest.useRealTimers();
  });

  it('should render with correct brandName (OpenMetadata or Collate)', async () => {
    // Mock Transi18next to actually render interpolated values
    const mockTransi18next = jest.fn(({ values }) => (
      <div data-testid="transi18next-mock">
        {values?.entityName && `Entity: ${values.entityName}`}
        {values?.brandName && ` Brand: ${values.brandName}`}
      </div>
    ));

    jest
      .spyOn(CommonUtils, 'Transi18next')
      .mockImplementation(mockTransi18next);

    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />, {
        wrapper: MemoryRouter,
      });
    });

    const bodyText = await screen.findByTestId('body-text');

    expect(bodyText).toBeInTheDocument();

    // Verify actual brand name is rendered
    expect(bodyText.textContent).toMatch(/OpenMetadata|Collate/);
    expect(bodyText.textContent).not.toContain('{{brandName}}');

    // Verify Transi18next was called with brandName parameter
    expect(mockTransi18next).toHaveBeenCalledWith(
      expect.objectContaining({
        i18nKey: 'message.permanently-delete-metadata',
        values: expect.objectContaining({
          entityName: 'zyx',
          brandName: 'OpenMetadata',
        }),
      }),
      expect.anything()
    );
  });
});
