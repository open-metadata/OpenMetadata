import { fireEvent, render, screen } from '@testing-library/react';
import { TitleComponent } from './TitleComponent';

const mockHandleChange = jest.fn();
const mockOnKeyDown = jest.fn();

const mockProps = {
  value: 'test-value',
  onChange: mockHandleChange,
  onKeyDown: mockOnKeyDown,
  autoFocus: true,
  readOnly: false,
};

describe('TitleComponent', () => {
  it('should render TitleComponent', () => {
    render(<TitleComponent {...mockProps} />);

    expect(
      screen.getByTestId('entity-header-display-name')
    ).toBeInTheDocument();

    expect(screen.getByTestId('entity-header-display-name')).toHaveValue(
      'test-value'
    );
  });

  it('should render TitleComponent with readOnly', () => {
    render(<TitleComponent {...mockProps} readOnly />);

    expect(
      screen.getByTestId('entity-header-display-name')
    ).toBeInTheDocument();

    expect(screen.getByTestId('entity-header-display-name')).toHaveValue(
      'test-value'
    );

    expect(screen.getByTestId('entity-header-display-name')).toHaveAttribute(
      'readOnly'
    );
  });

  it('should render TitleComponent with autoFocus', () => {
    render(<TitleComponent {...mockProps} autoFocus />);

    expect(
      screen.getByTestId('entity-header-display-name')
    ).toBeInTheDocument();

    expect(screen.getByTestId('entity-header-display-name')).toHaveValue(
      'test-value'
    );

    expect(screen.getByTestId('entity-header-display-name')).toHaveFocus();
  });

  it('should render TitleComponent with onKeyDown', async () => {
    render(<TitleComponent {...mockProps} onKeyDown={mockOnKeyDown} />);

    const input = screen.getByTestId('entity-header-display-name');

    expect(input).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnKeyDown).toHaveBeenCalled();
  });

  it('should render TitleComponent with onChange', async () => {
    render(<TitleComponent {...mockProps} onChange={mockHandleChange} />);

    const input = screen.getByTestId('entity-header-display-name');

    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'test' } });

    expect(mockHandleChange).toHaveBeenCalled();
  });
});
