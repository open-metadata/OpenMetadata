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

import { Button } from '@openmetadata/ui-core-components';
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
import TierCard from '../TierCard/TierCard';
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
const mockUpdateTier = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockImplementation((...args) => mockGetTags(...args)),
}));

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader</div>);
});

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockReturnValue(<div>RichTextEditorPreviewer</div>);
});

const renderTierCard = (currentTier: string) => (
  <TierCard currentTier={currentTier} updateTier={mockUpdateTier}>
    <Button data-testid="edit-tier">Edit Tier</Button>
  </TierCard>
);

const openTierCard = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('edit-tier'));
  });
  await screen.findByTestId('Tier.Tier3');
};

describe('TierCard selection', () => {
  beforeEach(() => {
    mockUpdateTier.mockClear();
  });

  it('saves nothing when dismissed without a pick', async () => {
    render(renderTierCard('Tier.Tier1'));

    await openTierCard();
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });
    await waitFor(() =>
      expect(screen.queryByTestId('Tier.Tier3')).not.toBeInTheDocument()
    );

    expect(mockUpdateTier).not.toHaveBeenCalled();
  });

  it('saves a pick at once and shows it selected on reopen', async () => {
    const { rerender } = render(renderTierCard('Tier.Tier1'));

    await openTierCard();
    await act(async () => {
      fireEvent.click(screen.getByTestId('Tier.Tier3'));
    });

    expect(mockUpdateTier).toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier3' })
    );

    // Entity context propagates the saved tier while the picker is closed.
    await act(async () => {
      rerender(renderTierCard('Tier.Tier3'));
    });
    await openTierCard();

    expect(screen.getByTestId('Tier.Tier3')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });
});

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

describe('TierWidget permissions', () => {
  beforeEach(() => {
    mockUseGenericContextResult.isVersionView = false;
  });

  it('should render the add control when EditTier is granted', () => {
    mockUseGenericContextResult.permissions = {
      EditTier: true,
    } as unknown as OperationPermission;

    render(<TierWidget />);

    expect(screen.getByTestId('add-tier')).toBeInTheDocument();
  });

  it('should render the add control when only EditAll is granted', () => {
    mockUseGenericContextResult.permissions = {
      EditAll: true,
    } as unknown as OperationPermission;

    render(<TierWidget />);

    expect(screen.getByTestId('add-tier')).toBeInTheDocument();
  });

  it('should not render the add control when EditTier is denied despite EditAll', () => {
    mockUseGenericContextResult.permissions = {
      EditAll: true,
      EditTier: false,
    } as unknown as OperationPermission;

    render(<TierWidget />);

    expect(screen.queryByTestId('add-tier')).not.toBeInTheDocument();
  });

  it('should not render the add control on a version view', () => {
    mockUseGenericContextResult.permissions = {
      EditTier: true,
    } as unknown as OperationPermission;
    mockUseGenericContextResult.isVersionView = true;

    render(<TierWidget />);

    expect(screen.queryByTestId('add-tier')).not.toBeInTheDocument();
  });
});

const axiosError = {
  message: 'Request failed with status code 403',
  response: { status: 403, data: { message: 'Forbidden' } },
} as AxiosError;

const saveTier = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('add-tier'));
  });
  await act(async () => {
    fireEvent.click(await screen.findByTestId('Tier.Tier3'));
  });
};

// The widget swallows a failed save without toasting, because the pages that
// render it (Domain, DataProduct) toast in their own onUpdate before rethrowing.
describe('TierWidget failed save', () => {
  beforeEach(() => {
    mockOnUpdate.mockReset();
    mockUseGenericContextResult.isVersionView = false;
    (showErrorToast as jest.Mock).mockClear();
    mockUseGenericContextResult.permissions = {
      EditTier: true,
    } as unknown as OperationPermission;
  });

  it('should toast once when the page updater toasts and rethrows', async () => {
    mockOnUpdate.mockImplementation(async () => {
      showErrorToast(axiosError);

      throw axiosError;
    });

    render(<TierWidget />);
    await saveTier();

    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalledTimes(1));

    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('should toast once when the page updater toasts and swallows', async () => {
    mockOnUpdate.mockImplementation(async () => {
      showErrorToast(axiosError);
    });

    render(<TierWidget />);
    await saveTier();

    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalledTimes(1));

    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('should not toast on a successful save', async () => {
    mockOnUpdate.mockResolvedValue(undefined);

    render(<TierWidget />);
    await saveTier();

    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalledTimes(1));

    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
