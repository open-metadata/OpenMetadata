/*
 *  Copyright 2023 Collate.
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
import { ReactNode } from 'react';
import { ProviderType } from '../../../../../../generated/tests/dataQualityDimension';
import {
  createDataQualityDimension,
  deleteDataQualityDimension,
  getDataQualityDimensions,
  getDataQualityDimensionTestCaseCounts,
  getDataQualityDimensionTestDefinitionCounts,
  patchDataQualityDimension,
} from '../../../../../../rest/dataQualityDimensionAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import DataQualitySettings from './DataQualitySettings';
import DimensionSettingsForm from './DimensionSettingsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/dataQualityDimensionAPI', () => ({
  getDataQualityDimensions: jest.fn(),
  getDataQualityDimensionTestCaseCounts: jest.fn(),
  getDataQualityDimensionTestDefinitionCounts: jest.fn(),
  createDataQualityDimension: jest.fn(),
  patchDataQualityDimension: jest.fn(),
  deleteDataQualityDimension: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const SYSTEM = {
  id: 'sys-1',
  name: 'accuracy',
  displayName: 'Accuracy',
  description: 'Values reflect reality.',
  provider: ProviderType.System,
  style: { color: '#175CD3' },
};
const CUSTOM = {
  id: 'cust-1',
  name: 'freshness',
  displayName: 'Freshness',
  description: 'Data arrives on time.',
  provider: ProviderType.User,
  style: { color: '#067647' },
};

const onNavigate = jest.fn();
let headerActions: ReactNode;
const onSetHeaderActions = (actions: ReactNode) => {
  headerActions = actions;
};

const inputOf = (testId: string) =>
  screen.getByTestId(testId).querySelector('input, textarea') as
    | HTMLInputElement
    | HTMLTextAreaElement;

const renderList = async () => {
  render(
    <DataQualitySettings
      onNavigate={onNavigate}
      onSetHeaderActions={onSetHeaderActions}
    />
  );
  await screen.findByTestId('dimensions-table');
};

describe('Data Quality settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDataQualityDimensions as jest.Mock).mockResolvedValue({
      data: [SYSTEM, CUSTOM],
    });
    (getDataQualityDimensionTestCaseCounts as jest.Mock).mockResolvedValue({
      'sys-1': 6,
      'cust-1': 2,
    });
    (
      getDataQualityDimensionTestDefinitionCounts as jest.Mock
    ).mockResolvedValue({ 'cust-1': 1 });
    (deleteDataQualityDimension as jest.Mock).mockResolvedValue({});
    (createDataQualityDimension as jest.Mock).mockResolvedValue({});
    (patchDataQualityDimension as jest.Mock).mockResolvedValue({});
  });

  it('lists dimensions with type, test case counts and read-only system rows', async () => {
    await renderList();

    expect(screen.getByTestId('dimension-accuracy')).toHaveTextContent(
      'label.system'
    );
    expect(screen.getByTestId('dimension-accuracy')).toHaveTextContent('6');
    expect(screen.getByTestId('dimension-freshness')).toHaveTextContent(
      'label.custom'
    );
    expect(screen.getByTestId('edit-accuracy')).toBeDisabled();
    expect(screen.getByTestId('delete-accuracy')).toBeDisabled();
    expect(screen.getByTestId('edit-freshness')).toBeEnabled();
  });

  it('shows "--" rather than 0 when the counts could not be fetched', async () => {
    (getDataQualityDimensionTestCaseCounts as jest.Mock).mockRejectedValue(
      new Error('boom')
    );
    await renderList();

    expect(screen.getByTestId('dimension-freshness')).toHaveTextContent('--');
  });

  it('filters by name, display name or description', async () => {
    await renderList();

    fireEvent.change(inputOf('search-dimensions'), {
      target: { value: 'on time' },
    });

    await waitFor(() =>
      expect(screen.queryByTestId('dimension-accuracy')).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('dimension-freshness')).toBeInTheDocument();
  });

  it('header Add and row Edit open the dimension form', async () => {
    await renderList();
    render(<>{headerActions}</>);

    fireEvent.click(screen.getByTestId('add-dimension'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'data-quality',
      isEditing: true,
    });

    fireEvent.click(screen.getByTestId('edit-freshness'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'data-quality',
      isEditing: true,
      itemId: 'freshness',
    });
  });

  it('delete warns about the affected test cases and definitions, then deletes', async () => {
    await renderList();

    fireEvent.click(screen.getByTestId('delete-freshness'));
    const dialog = await screen.findByTestId('delete-dimension-dialog');

    expect(dialog).toHaveTextContent('message.dimension-in-use-count');
    expect(dialog).toHaveTextContent(
      'message.dimension-in-use-test-definition-count'
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-dimension'));
    });

    expect(deleteDataQualityDimension).toHaveBeenCalledWith('cust-1');
    expect(getDataQualityDimensions).toHaveBeenCalledTimes(2);
  });

  it('cannot be closed while the delete is in flight', async () => {
    let finishDelete: () => void = () => undefined;
    (deleteDataQualityDimension as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishDelete = resolve;
        })
    );
    await renderList();
    fireEvent.click(screen.getByTestId('delete-freshness'));
    await screen.findByTestId('delete-dimension-dialog');

    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-dimension'));
    });

    expect(
      screen.queryByRole('button', { name: /close/i })
    ).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('delete-dimension-dialog'), {
      key: 'Escape',
    });

    expect(screen.getByTestId('delete-dimension-dialog')).toBeInTheDocument();

    await act(async () => {
      finishDelete();
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId('delete-dimension-dialog')
      ).not.toBeInTheDocument()
    );
  });

  it('creates a dimension with its colour and returns to the list', async () => {
    render(<DimensionSettingsForm showHint={false} onNavigate={onNavigate} />);
    await screen.findByTestId('dimension-form');

    fireEvent.change(inputOf('dimension-name'), {
      target: { value: 'timeliness' },
    });
    fireEvent.click(screen.getByTestId('dimension-color-2'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(createDataQualityDimension).toHaveBeenCalledWith({
      name: 'timeliness',
      displayName: undefined,
      description: undefined,
      style: { color: '#067647' },
    });
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'data-quality',
      isEditing: false,
    });
  });

  it('rejects a name with spaces', async () => {
    render(<DimensionSettingsForm showHint={false} onNavigate={onNavigate} />);
    await screen.findByTestId('dimension-form');

    fireEvent.change(inputOf('dimension-name'), {
      target: { value: 'not valid' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(
      await screen.findByText('message.dimension-name-invalid')
    ).toBeInTheDocument();
    expect(createDataQualityDimension).not.toHaveBeenCalled();
  });

  it('edits an existing dimension with a JSON patch and a locked name', async () => {
    render(
      <DimensionSettingsForm
        itemId="freshness"
        showHint={false}
        onNavigate={onNavigate}
      />
    );
    await waitFor(() =>
      expect(inputOf('dimension-display-name')).toHaveValue('Freshness')
    );

    expect(inputOf('dimension-name')).toBeDisabled();

    fireEvent.change(inputOf('dimension-display-name'), {
      target: { value: 'Timeliness' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(patchDataQualityDimension).toHaveBeenCalledWith('cust-1', [
      { op: 'replace', path: '/displayName', value: 'Timeliness' },
    ]);
  });

  it('a stale edit link returns to the list with an error', async () => {
    render(
      <DimensionSettingsForm
        itemId="deleted-dimension"
        showHint={false}
        onNavigate={onNavigate}
      />
    );

    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith({
        type: 'page',
        page: 'data-quality',
        isEditing: false,
      })
    );

    expect(showErrorToast).toHaveBeenCalled();
  });
});
