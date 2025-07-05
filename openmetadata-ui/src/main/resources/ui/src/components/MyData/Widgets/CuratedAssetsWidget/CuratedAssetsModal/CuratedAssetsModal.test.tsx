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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Form, FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import CuratedAssetsModal from './CuratedAssetsModal';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock(
  '../AdvancedAssetsFilterField/AdvancedAssetsFilterField.component',
  () => ({
    AdvancedAssetsFilterField: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="advanced-assets-filter-field">
          Advanced Assets Filter Field
        </div>
      )),
  })
);

jest.mock('../SelectAssetTypeField/SelectAssetTypeField.component', () => ({
  SelectAssetTypeField: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="select-asset-type-field">Select Asset Type Field</div>
    )),
}));

jest.mock('../../../../../utils/CuratedAssetsUtils', () => ({
  getSelectedResourceCount: jest.fn().mockResolvedValue({
    entityCount: 10,
    resourcesWithNonZeroCount: [],
  }),
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const defaultProps = {
  curatedAssetsConfig: null,
  onCancel: mockOnCancel,
  onSave: mockOnSave,
  isOpen: true,
};

describe('CuratedAssetsModal', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with create widget title when no data provided', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    expect(screen.getByText('label.create-widget')).toBeInTheDocument();
  });

  it('renders modal with edit widget title when data is provided', () => {
    const propsWithData = {
      ...defaultProps,
      curatedAssetsConfig: { title: 'Test Widget' },
    };

    render(<CuratedAssetsModal {...propsWithData} />);

    expect(screen.getByText('label.edit-widget')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    const cancelButton = screen.getByTestId('cancelButton');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('disables save button when required fields are empty', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => []);
    render(<CuratedAssetsModal {...defaultProps} />);

    const saveButton = screen.getByTestId('saveButton');

    expect(saveButton).toBeDisabled();
  });

  it('calls onSave when save button is clicked', async () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => ['table']);
    render(
      <CuratedAssetsModal
        {...defaultProps}
        curatedAssetsConfig={{
          title: 'Test Widget',
          resources: ['table'],
          queryFilter: '{"query":{"bool":{"must":[]}}}',
        }}
      />
    );

    const saveButton = screen.getByTestId('saveButton');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockOnSave).toHaveBeenCalled();
  });

  it('enables save button when all required fields are filled', async () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => ['table']);

    render(
      <CuratedAssetsModal
        {...defaultProps}
        curatedAssetsConfig={{
          title: 'Test Widget',
          resources: ['table'],
          queryFilter: '{"query":{"bool":{"must":[]}}}',
        }}
      />
    );

    const saveButton = screen.getByTestId('saveButton');

    expect(saveButton).toBeEnabled();
  });

  it('renders title input field', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    const titleInput = screen.getByTestId('title-input');

    expect(titleInput).toBeInTheDocument();
  });

  it('renders SelectAssetTypeField component', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    expect(screen.getByTestId('select-asset-type-field')).toBeInTheDocument();
  });

  it('renders AdvancedAssetsFilterField component', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    expect(
      screen.getByTestId('advanced-assets-filter-field')
    ).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    const propsWithClosedModal = {
      ...defaultProps,
      isOpen: false,
    };

    render(<CuratedAssetsModal {...propsWithClosedModal} />);

    expect(
      screen.queryByTestId('curated-assets-modal-container')
    ).not.toBeInTheDocument();
  });
});
