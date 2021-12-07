/*
 *  Copyright 2021 Collate
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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import IconButton from './IconButton';

const mockFunction = jest.fn();
const icon = <SVGIcons alt="Edit" icon={Icons.EDIT} />;

describe('Test Icon Button Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <IconButton icon={icon} title="test" onClick={mockFunction} />
    );

    const iconButton = getByTestId('icon-button');

    expect(iconButton).toBeInTheDocument();
  });

  it('OnClick callback function should call', () => {
    const { getByTestId } = render(
      <IconButton icon={icon} title="test" onClick={mockFunction} />
    );

    const iconButton = getByTestId('icon-button');
    fireEvent(
      iconButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});
