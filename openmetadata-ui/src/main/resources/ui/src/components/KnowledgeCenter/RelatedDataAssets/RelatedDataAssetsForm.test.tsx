import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DataAssetOption } from 'components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { RelatedDataAssetsForm } from './RelatedDataAssetsForm';
jest.mock(
  'components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () => jest.fn(() => <div data-testid="DataAssetAsyncSelectList" />)
);

const mockCancel = jest.fn();
const mockSubmit = jest.fn();
const mockDefaultValues: string[] = [];
const mockInitialOptions: DataAssetOption[] = [];

describe('RelatedDataAssetsForm', () => {
  it('should render', () => {
    render(
      <RelatedDataAssetsForm
        defaultValue={mockDefaultValues}
        initialOptions={mockInitialOptions}
        onCancel={mockCancel}
        onSubmit={mockSubmit}
      />
    );

    expect(screen.getByTestId('DataAssetAsyncSelectList')).toBeInTheDocument();
    expect(screen.getByTestId('cancelDataAssets')).toBeInTheDocument();
    expect(screen.getByTestId('saveDataAssets')).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <RelatedDataAssetsForm
        defaultValue={mockDefaultValues}
        initialOptions={mockInitialOptions}
        onCancel={mockCancel}
        onSubmit={mockSubmit}
      />
    );
    fireEvent.click(screen.getByTestId('cancelDataAssets'));

    expect(mockCancel).toHaveBeenCalled();
  });

  it('should call onSubmit when save button is clicked', async () => {
    render(
      <RelatedDataAssetsForm
        defaultValue={mockDefaultValues}
        initialOptions={mockInitialOptions}
        onCancel={mockCancel}
        onSubmit={mockSubmit}
      />
    );
    fireEvent.click(screen.getByTestId('saveDataAssets'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
    });
  });
});
