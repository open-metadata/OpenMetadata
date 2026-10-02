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
import { Domain } from '../../../generated/entity/domains/domain';
import { showErrorToast } from '../../../utils/ToastUtils';
import TierWidget from './TierWidget';

const mockTierData = [
  {
    id: 'tier1-id',
    name: 'Tier1',
    fullyQualifiedName: 'Tier.Tier1',
    description: '**Tier1 desc**\n\nTier1 details',
    version: 0.1,
    updatedAt: 1665646906357,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/tags/Tier/Tier1',
    deprecated: false,
    deleted: false,
  },
  {
    id: 'tier3-id',
    name: 'Tier3',
    fullyQualifiedName: 'Tier.Tier3',
    description: '**Tier3 desc**\n\nTier3 details',
    version: 0.1,
    updatedAt: 1665646906357,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/tags/Tier/Tier3',
    deprecated: false,
    deleted: false,
  },
];

const mockGetTags = jest.fn().mockResolvedValue({ data: mockTierData });

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockImplementation((...args) => mockGetTags(...args)),
}));

jest.mock('../Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn().mockReturnValue(<div>RichTextEditorPreviewer</div>)
);

const mockOnUpdate = jest.fn();

const mockUseGenericContextResult = {
  data: { name: 'domain', tags: [] } as unknown as Domain,
  permissions: {} as OperationPermission,
  onUpdate: mockOnUpdate,
  isVersionView: false,
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContextResult),
}));

const axiosError = {
  message: 'Request failed with status code 403',
  config: { method: 'patch' },
  response: { status: 403, data: { message: 'Forbidden' } },
} as AxiosError;

describe('TierWidget double-error-toast on a toast-and-rethrow updater', () => {
  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockUseGenericContextResult.permissions = {
      EditTier: true,
    } as unknown as OperationPermission;
    mockOnUpdate.mockImplementation(async () => {
      showErrorToast(axiosError);

      throw axiosError;
    });
  });

  it('fires showErrorToast once when the tier update fails (Domain-page wiring)', async () => {
    render(<TierWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-tier'));
    });
    await screen.findByTestId('radio-btn-Tier3');

    await act(async () => {
      fireEvent.click(screen.getByTestId('radio-btn-Tier3'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('update-tier-card'));
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onUpdate with the tier-tagged entity (save path ran)', async () => {
    render(<TierWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-tier'));
    });
    await screen.findByTestId('radio-btn-Tier3');

    await act(async () => {
      fireEvent.click(screen.getByTestId('radio-btn-Tier3'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('update-tier-card'));
    });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TierWidget failure-path variants at the widget boundary', () => {
  beforeEach(() => {
    (showErrorToast as jest.Mock).mockClear();
    mockOnUpdate.mockClear();
    mockUseGenericContextResult.permissions = {
      EditTier: true,
    } as unknown as OperationPermission;
  });

  it('does not double toast on a rejecting swallow-updater (G6)', async () => {
    mockOnUpdate.mockImplementation(async () => {
      showErrorToast(axiosError);
    });

    render(<TierWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-tier'));
    });
    await screen.findByTestId('radio-btn-Tier3');

    await act(async () => {
      fireEvent.click(screen.getByTestId('radio-btn-Tier3'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('update-tier-card'));
    });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    });

    expect(showErrorToast as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('shows zero toasts on a successful save (G5)', async () => {
    mockOnUpdate.mockResolvedValue(undefined);

    render(<TierWidget />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-tier'));
    });
    await screen.findByTestId('radio-btn-Tier3');

    await act(async () => {
      fireEvent.click(screen.getByTestId('radio-btn-Tier3'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('update-tier-card'));
    });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    });

    expect(showErrorToast as jest.Mock).not.toHaveBeenCalled();
  });
});
