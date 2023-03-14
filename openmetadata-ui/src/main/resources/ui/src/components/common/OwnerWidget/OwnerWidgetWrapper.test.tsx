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
import React from 'react';

import OwnerWidgetWrapper from './OwnerWidgetWrapper.component';

const dummyProps = {
  visible: true,
  currentUser: { id: '1', type: 'User' },
  hideWidget: jest.fn(),
};

describe('OwnerWidgetWrapper', () => {
  it('Should renders the component when visible is true', () => {
    render(<OwnerWidgetWrapper {...dummyProps} />);
    const dropDownList = screen.getByTestId('dropdown-list');
    const searchBox = screen.getByTestId('searchInputText');

    expect(dropDownList).toBeInTheDocument();
    expect(searchBox).toBeInTheDocument();
  });

  it('Should not render the component when visible is false', () => {
    render(<OwnerWidgetWrapper {...dummyProps} visible={false} />);

    const component = screen.queryByTestId('dropdown-list');

    expect(component).toBeNull();
  });
});
