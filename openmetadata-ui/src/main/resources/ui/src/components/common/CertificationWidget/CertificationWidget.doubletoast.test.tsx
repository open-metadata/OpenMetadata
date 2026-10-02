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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Tag } from '../../../generated/entity/classification/tag';
import { Domain } from '../../../generated/entity/domains/domain';
import { showErrorToast } from '../../../utils/ToastUtils';
import CertificationWidget from './CertificationWidget';

const mockOnUpdate = jest.fn();

const mockUseGenericContextResult = {
  data: { name: 'domain', certification: undefined } as unknown as Domain,
  permissions: {} as OperationPermission,
  onUpdate: mockOnUpdate,
  isVersionView: false,
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContextResult),
}));

jest.mock('../../Certification/Certification.component', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        onCertificationUpdate,
      }: {
        onCertificationUpdate?: (tag?: Tag) => Promise<void>;
      }) => (
        <div>
          <button
            data-testid="trigger-cert-update"
            onClick={() => onCertificationUpdate?.({} as Tag)}>
            Save
          </button>
        </div>
      )
    )
);

jest.mock('../CertificationTag/CertificationTag', () =>
  jest.fn().mockReturnValue(<div>CertificationTag</div>)
);

jest.mock('../WidgetCard/WidgetCard', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        headerExtra,
        children,
      }: {
        headerExtra?: React.ReactNode;
        children?: React.ReactNode;
      }) => (
        <div>
          {headerExtra}
          {children}
        </div>
      )
    )
);

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const axiosError = {
  message: 'Request failed with status code 403',
  config: { method: 'patch' },
  response: { status: 403, data: { message: 'Forbidden' } },
} as AxiosError;

describe('CertificationWidget double-error-toast on a toast-and-rethrow updater', () => {
  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockUseGenericContextResult.permissions = {
      EditCertification: true,
    } as unknown as OperationPermission;
    mockOnUpdate.mockImplementation(async () => {
      showErrorToast(axiosError);

      throw axiosError;
    });
  });

  it('fires showErrorToast once when the certification update fails (Domain-page wiring)', async () => {
    render(<CertificationWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-cert-update'));
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CertificationWidget failure-path variants at the widget boundary', () => {
  beforeEach(() => {
    (showErrorToast as jest.Mock).mockClear();
    mockOnUpdate.mockClear();
    mockUseGenericContextResult.permissions = {
      EditCertification: true,
    } as unknown as OperationPermission;
  });

  it('does not double toast on a rejecting swallow-updater (G6)', async () => {
    mockOnUpdate.mockImplementation(async () => {
      showErrorToast(axiosError);
    });

    render(<CertificationWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-cert-update'));
    });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    });

    expect(showErrorToast as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('shows zero toasts on a successful save (G5)', async () => {
    mockOnUpdate.mockResolvedValue(undefined);

    render(<CertificationWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-cert-update'));
    });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    });

    expect(showErrorToast as jest.Mock).not.toHaveBeenCalled();
  });
});
