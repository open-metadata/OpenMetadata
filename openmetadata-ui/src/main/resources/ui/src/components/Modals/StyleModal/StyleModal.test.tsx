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
import { act, fireEvent, render, screen } from '@testing-library/react';
import StyleModal from './StyleModal.component';
import { StyleModalProps } from './StyleModal.interface';

const mockProps: StyleModalProps = {
  open: true,
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

jest.mock('components/common/ColorPicker/ColorPicker.component', () => {
  return jest.fn().mockImplementation(() => <div>ColorPicker.component</div>);
});

describe('StyleModal component', () => {
  it('Component should render', async () => {
    render(<StyleModal {...mockProps} />);

    expect(await screen.findByTestId('icon-url')).toBeInTheDocument();
    expect(
      await screen.findByText('ColorPicker.component')
    ).toBeInTheDocument();
  });

  it('Should call onCancel function, onClick of cancel', async () => {
    render(<StyleModal {...mockProps} />);
    const cancelBtn = await screen.findByText('label.cancel');

    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('Should call onSubmit function, onClick of submit', async () => {
    render(<StyleModal {...mockProps} />);
    const submitBtn = await screen.findByText('label.save');
    const url = await screen.findByTestId('icon-url');

    expect(submitBtn).toBeInTheDocument();
    expect(url).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(url, { target: { value: 'url' } });
      fireEvent.click(submitBtn);
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith({
      color: undefined,
      iconURL: 'url',
    });
  });
});
