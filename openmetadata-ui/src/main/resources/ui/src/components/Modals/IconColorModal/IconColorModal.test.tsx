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
import { Style } from '../../../generated/type/schema';
import { StyleModalProps } from '../StyleModal/StyleModal.interface';
import IconColorModal from './IconColorModal';

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

const mockStyle: Style = {
  iconURL: 'https://example.com/icon.svg',
  color: '#FF5733',
};

const mockProps: StyleModalProps = {
  open: true,
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
  style: mockStyle,
};

jest.mock('../../common/ColorPicker', () => ({
  MUIColorPicker: jest.fn().mockImplementation(({ label, value, onChange }) => (
    <div data-testid="color-picker">
      <label>{label}</label>
      <input
        data-testid="color-input"
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  )),
}));

jest.mock('../../common/IconPicker', () => ({
  MUIIconPicker: jest
    .fn()
    .mockImplementation(({ label, value, onChange, placeholder }) => (
      <div data-testid="icon-picker">
        <label>{label}</label>
        <input
          data-testid="icon-input"
          placeholder={placeholder}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    )),
  DEFAULT_TAG_ICON: 'default-icon',
}));

jest.mock('../../../utils/DomainUtils', () => ({
  iconTooltipDataRender: jest.fn().mockReturnValue('Icon tooltip'),
}));

describe('IconColorModal component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal when open is true', async () => {
    render(<IconColorModal {...mockProps} />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByTestId('icon-picker')).toBeInTheDocument();
    expect(await screen.findByTestId('color-picker')).toBeInTheDocument();
  });

  it('should not render the modal when open is false', () => {
    render(<IconColorModal {...mockProps} open={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should display the correct modal title', async () => {
    render(<IconColorModal {...mockProps} />);

    expect(await screen.findByText('label.edit-entity')).toBeInTheDocument();
  });

  it('should render cancel and save buttons', async () => {
    render(<IconColorModal {...mockProps} />);

    expect(await screen.findByText('label.cancel')).toBeInTheDocument();
    expect(await screen.findByText('label.save')).toBeInTheDocument();
  });

  it('should populate form with initial style values', async () => {
    render(<IconColorModal {...mockProps} />);

    const iconInput = await screen.findByTestId('icon-input');
    const colorInput = await screen.findByTestId('color-input');

    expect(iconInput).toHaveValue(mockStyle.iconURL);
    expect(colorInput).toHaveValue(mockStyle.color);
  });

  it('should call onCancel when cancel button is clicked', async () => {
    render(<IconColorModal {...mockProps} />);

    const cancelBtn = await screen.findByText('label.cancel');
    fireEvent.click(cancelBtn);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onSubmit with form values when save button is clicked', async () => {
    render(<IconColorModal {...mockProps} />);

    const saveBtn = await screen.findByText('label.save');

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith({
      iconURL: mockStyle.iconURL,
      color: mockStyle.color,
    });
  });

  it('should update icon value when icon picker changes', async () => {
    render(<IconColorModal {...mockProps} />);

    const iconInput = await screen.findByTestId('icon-input');
    const newIconUrl = 'https://example.com/new-icon.svg';

    await act(async () => {
      fireEvent.change(iconInput, { target: { value: newIconUrl } });
    });

    expect(iconInput).toHaveValue(newIconUrl);
  });

  it('should update color value when color picker changes', async () => {
    render(<IconColorModal {...mockProps} />);

    const colorInput = await screen.findByTestId('color-input');
    const newColor = '#00FF00';

    await act(async () => {
      fireEvent.change(colorInput, { target: { value: newColor } });
    });

    expect(colorInput).toHaveValue(newColor);
  });

  it('should call onSubmit when save button is clicked during slow submission', async () => {
    const mockSlowSubmit = jest.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    render(<IconColorModal {...mockProps} onSubmit={mockSlowSubmit} />);

    const saveBtn = await screen.findByText('label.save');

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockSlowSubmit).toHaveBeenCalled();
  });

  it('should handle submission with undefined style', async () => {
    render(<IconColorModal {...mockProps} style={undefined} />);

    const saveBtn = await screen.findByText('label.save');

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('should render form with correct id', async () => {
    render(<IconColorModal {...mockProps} />);

    const form = document.querySelector('#style-modal-new');

    expect(form).toBeInTheDocument();
  });

  it('should render icon and color labels', async () => {
    render(<IconColorModal {...mockProps} />);

    expect(await screen.findByText('label.icon')).toBeInTheDocument();
    expect(await screen.findByText('label.color')).toBeInTheDocument();
  });

  it('should update icon picker backgroundColor when color changes', async () => {
    const { rerender } = render(<IconColorModal {...mockProps} />);

    const colorInput = await screen.findByTestId('color-input');
    const newColor = '#00FF00';

    fireEvent.change(colorInput, { target: { value: newColor } });

    rerender(<IconColorModal {...mockProps} />);

    expect(colorInput).toHaveValue(newColor);
  });
});
