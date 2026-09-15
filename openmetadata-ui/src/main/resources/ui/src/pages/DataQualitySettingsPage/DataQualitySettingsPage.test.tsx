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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DIMENSION_COLOR_PALETTE } from '../../constants/DataQualityDimension.constants';
import { ProviderType } from '../../generated/tests/dataQualityDimension';
import {
  createDataQualityDimension,
  deleteDataQualityDimension,
  getDataQualityDimensions,
  getDataQualityDimensionTestCaseCounts,
  getDataQualityDimensionTestDefinitionCounts,
  patchDataQualityDimension,
} from '../../rest/dataQualityDimensionAPI';
import DataQualitySettingsPage from './DataQualitySettingsPage';

const CUSTOM_DIMENSION = {
  id: 'dim-custom',
  name: 'BCBS-239',
  displayName: 'BCBS 239',
  description: 'Risk data aggregation',
  provider: ProviderType.User,
  style: { color: '#6938EF' },
};

jest.mock('../../rest/dataQualityDimensionAPI', () => ({
  getDataQualityDimensions: jest.fn(),
  getDataQualityDimensionTestCaseCounts: jest.fn(),
  getDataQualityDimensionTestDefinitionCounts: jest.fn(),
  createDataQualityDimension: jest.fn(),
  patchDataQualityDimension: jest.fn(),
  deleteDataQualityDimension: jest.fn(),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock('../../components/PageHeader/PageHeader.component', () => {
  return jest.fn().mockImplementation(() => <div>PageHeader</div>);
});
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>Breadcrumb</div>);
  }
);
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const renderPage = () =>
  render(<DataQualitySettingsPage />, { wrapper: MemoryRouter });

describe('DataQualitySettingsPage', () => {
  beforeEach(() => {
    (getDataQualityDimensions as jest.Mock).mockResolvedValue({
      data: [CUSTOM_DIMENSION],
    });
    (getDataQualityDimensionTestCaseCounts as jest.Mock).mockResolvedValue({});
    (
      getDataQualityDimensionTestDefinitionCounts as jest.Mock
    ).mockResolvedValue({});
    (createDataQualityDimension as jest.Mock).mockResolvedValue({});
    (patchDataQualityDimension as jest.Mock).mockResolvedValue({});
    (deleteDataQualityDimension as jest.Mock).mockResolvedValue({});
  });

  const openCreateDrawer = async () => {
    await screen.findByText('BCBS 239');
    fireEvent.click(await screen.findByTestId('add-dimension'));

    return screen.findByTestId('dimension-name');
  };

  const openDeleteModal = async () => {
    await screen.findByText('BCBS 239');
    fireEvent.click(await screen.findByTestId('delete-BCBS-239'));

    return screen.findByTestId('confirm-button');
  };

  it('should list the dimensions returned by the API', async () => {
    renderPage();

    expect(await screen.findByText('BCBS 239')).toBeInTheDocument();
  });

  /**
   * The drawer's onClose fires twice — once from our own closeDrawer and again when the
   * overlay finishes transitioning — so anything it resets can land after a subsequent open
   * has already seeded the form. That showed up as an edit drawer whose fields were blank the
   * first time it was opened after a save, and populated on the second.
   */
  it('should populate the edit drawer the first time it is opened after a save', async () => {
    renderPage();

    await screen.findByText('BCBS 239');

    // Open in create mode, then dismiss — this is what leaves a pending close behind.
    fireEvent.click(await screen.findByTestId('add-dimension'));
    await screen.findByTestId('dimension-name');
    fireEvent.click(screen.getByTestId('cancel-btn'));

    // Now edit an existing dimension: its values must be there on this first open.
    fireEvent.click(await screen.findByTestId('edit-BCBS-239'));

    await waitFor(() => {
      expect(screen.getByTestId('dimension-name')).toHaveValue('BCBS-239');
    });

    expect(screen.getByTestId('dimension-display-name')).toHaveValue(
      'BCBS 239'
    );
    // Queried by element: the core TextArea spreads data-testid onto its wrapper and links its
    // label through aria-labelledby, so neither testid nor label lookup reaches the control.
    expect(document.querySelector('textarea')).toHaveValue(
      'Risk data aggregation'
    );
  });

  it('should keep the edit drawer populated when reopened for the same dimension', async () => {
    renderPage();

    await screen.findByText('BCBS 239');

    fireEvent.click(await screen.findByTestId('edit-BCBS-239'));
    await waitFor(() =>
      expect(screen.getByTestId('dimension-name')).toHaveValue('BCBS-239')
    );

    fireEvent.click(screen.getByTestId('cancel-btn'));

    fireEvent.click(await screen.findByTestId('edit-BCBS-239'));
    await waitFor(() =>
      expect(screen.getByTestId('dimension-name')).toHaveValue('BCBS-239')
    );
  });

  it('should open the create drawer with empty fields after editing a dimension', async () => {
    renderPage();

    await screen.findByText('BCBS 239');

    fireEvent.click(await screen.findByTestId('edit-BCBS-239'));
    await waitFor(() =>
      expect(screen.getByTestId('dimension-name')).toHaveValue('BCBS-239')
    );
    fireEvent.click(screen.getByTestId('cancel-btn'));

    fireEvent.click(await screen.findByTestId('add-dimension'));

    // The previously edited dimension must not leak into create mode.
    await waitFor(() =>
      expect(screen.getByTestId('dimension-name')).toHaveValue('')
    );
  });

  it('should create a dimension from the values entered in the drawer', async () => {
    renderPage();

    const nameInput = await openCreateDrawer();
    fireEvent.change(nameInput, { target: { value: 'timeliness' } });
    fireEvent.change(screen.getByTestId('dimension-display-name'), {
      target: { value: 'Timeliness' },
    });
    fireEvent.click(screen.getByTestId('save-dimension'));

    await waitFor(() =>
      expect(createDataQualityDimension).toHaveBeenCalledWith({
        name: 'timeliness',
        displayName: 'Timeliness',
        description: undefined,
        style: { color: DIMENSION_COLOR_PALETTE[0] },
      })
    );
  });

  it('should reject a name that is not a valid technical name', async () => {
    renderPage();

    const nameInput = await openCreateDrawer();
    fireEvent.change(nameInput, { target: { value: 'not a valid name' } });
    fireEvent.click(screen.getByTestId('save-dimension'));

    // The distinct message matters: the hint is shown when the field is valid, so reusing it
    // would leave the user with no visible change on a failed submit.
    expect(
      await screen.findByText('message.dimension-name-invalid')
    ).toBeInTheDocument();
    expect(createDataQualityDimension).not.toHaveBeenCalled();
  });

  it('should patch only what changed when an existing dimension is saved', async () => {
    renderPage();

    await screen.findByText('BCBS 239');
    fireEvent.click(await screen.findByTestId('edit-BCBS-239'));
    await waitFor(() =>
      expect(screen.getByTestId('dimension-name')).toHaveValue('BCBS-239')
    );

    fireEvent.change(screen.getByTestId('dimension-display-name'), {
      target: { value: 'BCBS 239 (risk)' },
    });
    fireEvent.click(screen.getByTestId('save-dimension'));

    await waitFor(() =>
      expect(patchDataQualityDimension).toHaveBeenCalledWith('dim-custom', [
        {
          op: 'replace',
          path: '/displayName',
          value: 'BCBS 239 (risk)',
        },
      ])
    );
    expect(createDataQualityDimension).not.toHaveBeenCalled();
  });

  it('should delete the dimension once the confirmation is accepted', async () => {
    renderPage();

    fireEvent.click(await openDeleteModal());

    await waitFor(() =>
      expect(deleteDataQualityDimension).toHaveBeenCalledWith('dim-custom')
    );
    // The list is refetched so the deleted row disappears.
    expect(getDataQualityDimensions).toHaveBeenCalledTimes(2);
  });

  it('should not delete anything when the confirmation is dismissed', async () => {
    renderPage();

    await openDeleteModal();
    fireEvent.click(screen.getByTestId('cancel-button'));

    await waitFor(() =>
      expect(screen.queryByTestId('confirm-button')).not.toBeInTheDocument()
    );
    expect(deleteDataQualityDimension).not.toHaveBeenCalled();
  });

  it('should warn about the test cases and test definitions that reference the dimension', async () => {
    (getDataQualityDimensionTestCaseCounts as jest.Mock).mockResolvedValue({
      'dim-custom': 4,
    });
    (
      getDataQualityDimensionTestDefinitionCounts as jest.Mock
    ).mockResolvedValue({ 'dim-custom': 2 });

    renderPage();

    await openDeleteModal();

    expect(
      screen.getByText('message.dimension-in-use-count')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.dimension-in-use-test-definition-count')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.dimension-impact-unknown')
    ).not.toBeInTheDocument();
  });

  it('should say the impact is unknown when a count could not be fetched', async () => {
    (getDataQualityDimensionTestCaseCounts as jest.Mock).mockRejectedValue(
      new Error('boom')
    );

    renderPage();

    await openDeleteModal();

    // A failed count must not read as "no test case uses this dimension".
    expect(
      screen.getByText('message.dimension-impact-unknown')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.dimension-in-use-count')
    ).not.toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('should not let a system dimension be edited or deleted', async () => {
    (getDataQualityDimensions as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'dim-system',
          name: 'Accuracy',
          displayName: 'Accuracy',
          provider: ProviderType.System,
          style: { color: '#067647' },
        },
      ],
    });

    renderPage();

    expect(await screen.findByTestId('edit-Accuracy')).toBeDisabled();
    expect(screen.getByTestId('delete-Accuracy')).toBeDisabled();
  });
});
