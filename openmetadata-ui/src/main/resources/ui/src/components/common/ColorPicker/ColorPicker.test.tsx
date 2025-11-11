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
import { render, screen } from '@testing-library/react';
import ColorPicker from './ColorPicker.component';

describe('ColorPicker component', () => {
  it('component should render', async () => {
    render(<ColorPicker />);

    expect(await screen.findByTestId('color-picker')).toBeInTheDocument();
    expect(await screen.findByTestId('color-input')).toBeInTheDocument();
  });

  it('Should have same value in color picker and input box', async () => {
    render(<ColorPicker value="#000000" />);

    expect(await screen.findByTestId('color-picker')).toHaveValue('#000000');
    expect(await screen.findByTestId('color-input')).toHaveValue('#000000');
  });
});
