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
  data: { name: 'domain' } as Domain,
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
        children,
        onCertificationUpdate,
      }: {
        children?: React.ReactNode;
        onCertificationUpdate?: (tag?: Tag) => Promise<void>;
      }) => (
        <>
          {children}
          <button
            data-testid="trigger-cert-update"
            onClick={() => onCertificationUpdate?.({} as Tag)}>
            Save
          </button>
        </>
      )
    )
);

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../CertificationTag/CertificationTag', () =>
  jest.fn().mockReturnValue(<div>CertificationTag</div>)
);

jest.mock('../WidgetCard/WidgetCard', () =>
  jest.fn().mockImplementation(({ headerExtra, children }) => (
    <div>
      {headerExtra}
      {children}
    </div>
  ))
);

describe('CertificationWidget permissions', () => {
  beforeEach(() => {
    mockUseGenericContextResult.isVersionView = false;
  });

  // EditCertification has no named flag, so the widget goes through the
  // can(Operation) escape hatch — these cases pin that wiring.
  it('should render the add control when EditCertification is granted', () => {
    mockUseGenericContextResult.permissions = {
      EditCertification: true,
    } as unknown as OperationPermission;

    render(<CertificationWidget />);

    expect(screen.getByTestId('add-certification')).toBeInTheDocument();
  });

  it('should render the add control when only EditAll is granted', () => {
    mockUseGenericContextResult.permissions = {
      EditAll: true,
    } as unknown as OperationPermission;

    render(<CertificationWidget />);

    expect(screen.getByTestId('add-certification')).toBeInTheDocument();
  });

  it('should not render the add control when EditCertification is denied despite EditAll', () => {
    mockUseGenericContextResult.permissions = {
      EditAll: true,
      EditCertification: false,
    } as unknown as OperationPermission;

    render(<CertificationWidget />);

    expect(screen.queryByTestId('add-certification')).not.toBeInTheDocument();
  });

  it('should not render the add control on a version view', () => {
    mockUseGenericContextResult.permissions = {
      EditCertification: true,
    } as unknown as OperationPermission;
    mockUseGenericContextResult.isVersionView = true;

    render(<CertificationWidget />);

    expect(screen.queryByTestId('add-certification')).not.toBeInTheDocument();
  });
});

const axiosError = {
  message: 'Request failed with status code 403',
  response: { status: 403, data: { message: 'Forbidden' } },
} as AxiosError;

// The widget swallows a failed save without toasting, because the pages that
// render it (Domain, DataProduct) toast in their own onUpdate before rethrowing.
describe('CertificationWidget failed save', () => {
  beforeEach(() => {
    mockOnUpdate.mockReset();
    (showErrorToast as jest.Mock).mockClear();
    mockUseGenericContextResult.isVersionView = false;
    mockUseGenericContextResult.permissions = {
      EditCertification: true,
    } as unknown as OperationPermission;
  });

  it('should toast once when the page updater toasts and rethrows', async () => {
    mockOnUpdate.mockImplementation(async () => {
      showErrorToast(axiosError);

      throw axiosError;
    });

    render(<CertificationWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-cert-update'));
    });

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledTimes(1));
  });

  it('should toast once when the page updater toasts and swallows', async () => {
    mockOnUpdate.mockImplementation(async () => {
      showErrorToast(axiosError);
    });

    render(<CertificationWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-cert-update'));
    });

    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalledTimes(1));

    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('should not toast on a successful save', async () => {
    mockOnUpdate.mockResolvedValue(undefined);

    render(<CertificationWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-cert-update'));
    });

    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalledTimes(1));

    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
