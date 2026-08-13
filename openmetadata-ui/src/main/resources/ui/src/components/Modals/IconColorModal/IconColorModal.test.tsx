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
import { FormEvent, ReactNode } from 'react';
import { Controller, FormProvider, UseFormReturn } from 'react-hook-form';
import { Style } from '../../../generated/type/schema';
import { StyleModalProps } from '../StyleModal/StyleModal.interface';
import IconColorModal from './IconColorModal';

type MockFieldProp = {
  id?: string;
  name: 'iconURL' | 'color';
  label: ReactNode;
  props?: { 'data-testid'?: string };
};

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest
    .fn()
    .mockImplementation(
      ({ children, onPress, isDisabled, 'data-testid': testId }) => (
        <button data-testid={testId} disabled={isDisabled} onClick={onPress}>
          {children}
        </button>
      )
    ),
  Dialog: Object.assign(
    jest.fn().mockImplementation(({ children, title }) => (
      <div role="dialog">
        <div>{title}</div>
        {children}
      </div>
    )),
    {
      Content: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
      Footer: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Modal: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  ModalOverlay: jest
    .fn()
    .mockImplementation(({ children, isOpen }) =>
      isOpen ? <div>{children}</div> : null
    ),
  FieldTypes: { COLOR_PICKER: 'color_picker', ICON_PICKER: 'icon_picker' },
  HelperTextType: { ALERT: 'alert', TOOLTIP: 'tooltip' },
  HookForm: ({
    children,
    form,
    id,
    onSubmit,
  }: {
    children: ReactNode;
    form: UseFormReturn<Style>;
    id?: string;
    onSubmit?: (event?: FormEvent<HTMLFormElement>) => void;
  }) => (
    <FormProvider {...form}>
      <form
        id={id}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}>
        {children}
      </form>
    </FormProvider>
  ),
  getField: (field: MockFieldProp) => {
    const testId = field.props?.['data-testid'] ?? field.id ?? field.name;

    return (
      <Controller
        key={field.id}
        name={field.name}
        render={({ field: { value, onChange } }) => (
          <div data-testid={testId}>
            <label>{field.label}</label>
            <input
              data-testid={`${testId}-input`}
              type="text"
              value={(value as string) ?? ''}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        )}
      />
    );
  },
}));

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

const mockStyle: Style = {
  iconURL: 'Cube01',
  color: '#FF5733',
};

const mockProps: StyleModalProps = {
  open: true,
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
  style: mockStyle,
};

jest.mock('../../common/IconPicker', () => ({
  AVAILABLE_ICONS: [
    { category: 'default', component: jest.fn(), name: 'LayersThree01' },
  ],
  DEFAULT_TAG_ICON: {
    category: 'default',
    component: jest.fn(),
    name: 'LayersThree01',
  },
}));

describe('IconColorModal component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal when open is true', async () => {
    render(<IconColorModal {...mockProps} />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByTestId('icon-picker-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('root/color')).toBeInTheDocument();
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

    const iconInput = await screen.findByTestId('icon-picker-btn-input');
    const colorInput = await screen.findByTestId('root/color-input');

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

    const iconInput = await screen.findByTestId('icon-picker-btn-input');
    const newIconUrl = 'Tag01';

    await act(async () => {
      fireEvent.change(iconInput, { target: { value: newIconUrl } });
    });

    expect(iconInput).toHaveValue(newIconUrl);
  });

  it('should update color value when color picker changes', async () => {
    render(<IconColorModal {...mockProps} />);

    const colorInput = await screen.findByTestId('root/color-input');
    const newColor = '#00FF00';

    await act(async () => {
      fireEvent.change(colorInput, { target: { value: newColor } });
    });

    expect(colorInput).toHaveValue(newColor);
  });

  it('should call onSubmit when save button is clicked during slow submission', async () => {
    const mockSlowSubmit = jest.fn(
      (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100))
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

    const colorInput = await screen.findByTestId('root/color-input');
    const newColor = '#00FF00';

    fireEvent.change(colorInput, { target: { value: newColor } });

    rerender(<IconColorModal {...mockProps} />);

    expect(colorInput).toHaveValue(newColor);
  });

  it('should refresh form values when reopened with a new style while staying mounted', async () => {
    const { rerender } = render(<IconColorModal {...mockProps} />);

    expect(await screen.findByTestId('icon-picker-btn-input')).toHaveValue(
      mockStyle.iconURL
    );

    rerender(<IconColorModal {...mockProps} open={false} />);

    const newStyle: Style = { iconURL: 'Tag01', color: '#00FF00' };
    rerender(<IconColorModal {...mockProps} open style={newStyle} />);

    const iconInput = await screen.findByTestId('icon-picker-btn-input');
    const colorInput = await screen.findByTestId('root/color-input');

    expect(iconInput).toHaveValue(newStyle.iconURL);
    expect(colorInput).toHaveValue(newStyle.color);
  });
});
