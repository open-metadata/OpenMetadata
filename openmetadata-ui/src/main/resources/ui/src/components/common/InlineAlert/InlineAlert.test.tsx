/*
 *  Copyright 2024 Collate.
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
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import InlineAlert from './InlineAlert';

const mockSetInlineAlertDetails = jest.fn();

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    inlineAlertDetails: undefined,
    setInlineAlertDetails: mockSetInlineAlertDetails,
  }),
}));

const mockProps = {
  type: 'error' as const,
  heading: 'Test Heading',
  description: 'Test Description',
  onClose: jest.fn(),
};

describe('InlineAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render alert with basic props', () => {
    render(<InlineAlert {...mockProps} />);

    expect(screen.getByText('Test Heading')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('should handle show more/less functionality when subDescription is provided', () => {
    const mockTestProps = {
      type: 'error' as const,
      heading: 'Test Heading',
      description:
        'This is a very long description that should be truncated and this is for test purpose. This is a very long description that should be and this is for test purpose. This is a very long desc',
      onClose: jest.fn(),
    };
    const subDescription = 'Additional details here';
    render(<InlineAlert {...mockTestProps} subDescription={subDescription} />);

    // Initially subDescription should not be visible
    expect(screen.queryByText(subDescription)).not.toBeInTheDocument();

    // Click "more" button
    fireEvent.click(screen.getByTestId('read-more-button'));

    expect(screen.getByText(/Additional details here/i)).toBeInTheDocument();

    // Click "less" button
    fireEvent.click(screen.getByTestId('read-less-button'));

    expect(screen.queryByText(subDescription)).not.toBeInTheDocument();
  });

  it('should not show more/less button when subDescription is not provided', () => {
    render(<InlineAlert {...mockProps} />);

    expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('read-less-button')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(<InlineAlert {...mockProps} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('should apply custom className when provided', () => {
    const customClass = 'custom-alert-class';
    const { container } = render(
      <InlineAlert {...mockProps} alertClassName={customClass} />
    );

    expect(container.querySelector(`.${customClass}`)).toBeInTheDocument();
  });

  it('should clear inlineAlertDetails on unmount', () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      inlineAlertDetails: { some: 'data' },
      setInlineAlertDetails: mockSetInlineAlertDetails,
    });

    const { unmount } = render(<InlineAlert {...mockProps} />);
    unmount();

    expect(mockSetInlineAlertDetails).toHaveBeenCalledWith(undefined);
  });
});
