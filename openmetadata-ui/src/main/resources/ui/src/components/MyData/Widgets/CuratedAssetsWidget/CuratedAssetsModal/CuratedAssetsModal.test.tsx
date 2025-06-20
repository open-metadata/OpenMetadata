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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CuratedAssetsModal from './CuratedAssetsModal';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock(
  '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    AdvanceSearchProvider: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  })
);

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
  APP_CONFIG_PATH: ['sourceConfig', 'config', 'appConfig'],
  getSelectedResourceCount: jest.fn().mockResolvedValue({
    entityCount: 10,
    resourcesWithNonZeroCount: [],
  }),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Modal: jest
    .fn()
    .mockImplementation(({ children, title, open, onCancel, onOk }) => {
      if (!open) {
        return null;
      }

      return (
        <div data-testid="curated-assets-modal-container">
          <div>{title}</div>
          <div>{children}</div>
          <button data-testid="cancelButton" onClick={onCancel}>
            Cancel
          </button>
          <button data-testid="saveButton" onClick={onOk}>
            Save
          </button>
        </div>
      );
    }),
  Form: {
    useForm: jest.fn().mockReturnValue([
      {
        resetFields: jest.fn(),
        submit: jest.fn(),
        setFieldValue: jest.fn(),
        getFieldValue: jest.fn().mockReturnValue(''),
      },
    ]),
    useWatch: jest.fn().mockReturnValue(''),
    Item: jest
      .fn()
      .mockImplementation(({ children, name }) => (
        <div data-testid={`form-item-${name?.join('-') || 'default'}`}>
          {children}
        </div>
      )),
  },
  Input: jest
    .fn()
    .mockImplementation(({ placeholder, autoFocus }) => (
      <input
        autoFocus={autoFocus}
        data-testid="title-input"
        placeholder={placeholder}
      />
    )),
  Button: jest
    .fn()
    .mockImplementation(({ children, onClick, disabled, type }) => (
      <button
        data-testid={`${type}-button`}
        disabled={disabled}
        type={type}
        onClick={onClick}>
        {children}
      </button>
    )),
  Typography: {
    Text: jest.fn().mockImplementation(({ children, className }) => (
      <span className={className} data-testid="typography-text">
        {children}
      </span>
    )),
  },
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const defaultProps = {
  curatedAssetsData: null,
  onCancel: mockOnCancel,
  onSave: mockOnSave,
  isSaveButtonDisabled: false,
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
      curatedAssetsData: { title: 'Test Widget' },
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

  it('calls onSave when save button is clicked', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    const saveButton = screen.getByTestId('saveButton');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalled();
  });

  it('disables save button when required fields are empty', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    const saveButton = screen.getByTestId('saveButton');

    expect(saveButton).toBeDisabled();
  });

  it('disables save button when isSaveButtonDisabled is true', () => {
    const propsWithDisabledSave = {
      ...defaultProps,
      isSaveButtonDisabled: true,
    };

    render(<CuratedAssetsModal {...propsWithDisabledSave} />);

    const saveButton = screen.getByTestId('saveButton');

    expect(saveButton).toBeDisabled();
  });

  it('enables save button when all required fields are filled', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    const saveButton = screen.getByTestId('saveButton');

    expect(saveButton).not.toBeDisabled();
  });

  it('renders form with correct test id', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    expect(screen.getByTestId('form-item-title')).toBeInTheDocument();
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

  it('resets form when cancel is clicked', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    const cancelButton = screen.getByTestId('cancelButton');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('handles form submission correctly', () => {
    render(<CuratedAssetsModal {...defaultProps} />);

    const saveButton = screen.getByTestId('saveButton');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalled();
  });
});
