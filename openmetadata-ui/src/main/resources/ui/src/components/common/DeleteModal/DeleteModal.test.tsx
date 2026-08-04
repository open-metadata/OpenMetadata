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
import { DeleteModal } from './DeleteModal';

const CANCEL_BUTTON = 'cancel-button' as const;
const CONFIRM_BUTTON = 'confirm-button' as const;

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest
    .fn()
    .mockImplementation(
      ({ children, onPress, isDisabled, isLoading, ...rest }) => (
        <button disabled={isDisabled} onClick={onPress} {...rest}>
          {isLoading ? <div data-testid="loader" /> : children}
        </button>
      )
    ),
  Dialog: Object.assign(
    jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
    {
      Header: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Grid: Object.assign(
    jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
    {
      Item: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  FeaturedIcon: jest.fn().mockReturnValue(<div data-testid="featured-icon" />),
  Modal: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  ModalOverlay: jest
    .fn()
    .mockImplementation(({ children, isOpen }) =>
      isOpen ? <div>{children}</div> : null
    ),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('../Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader" />)
);

const defaultProps = {
  open: true,
  entityTitle: 'Test Entity',
  message: 'Are you sure you want to delete?',
  onCancel: jest.fn(),
  onDelete: jest.fn(),
};

describe('DeleteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with required props', () => {
    render(<DeleteModal {...defaultProps} />);

    expect(screen.getByText(/Test Entity/)).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete?')
    ).toBeInTheDocument();
    expect(screen.getByTestId(CANCEL_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(CONFIRM_BUTTON)).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    render(<DeleteModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId(CANCEL_BUTTON)).not.toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<DeleteModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId(CANCEL_BUTTON));

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete when confirm button is clicked', () => {
    render(<DeleteModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId(CONFIRM_BUTTON));

    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it('should disable both buttons when isDeleting is true', () => {
    render(<DeleteModal {...defaultProps} isDeleting />);

    expect(screen.getByTestId(CANCEL_BUTTON)).toBeDisabled();
    expect(screen.getByTestId(CONFIRM_BUTTON)).toBeDisabled();
  });

  it('should show loader on confirm button when isDeleting is true', () => {
    render(<DeleteModal {...defaultProps} isDeleting />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByText('label.delete')).not.toBeInTheDocument();
  });

  it('should show delete label on confirm button when not deleting', () => {
    render(<DeleteModal {...defaultProps} isDeleting={false} />);

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });
});
