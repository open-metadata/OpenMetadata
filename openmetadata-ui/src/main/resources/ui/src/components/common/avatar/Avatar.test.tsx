/*
 *  Copyright 2022 Collate
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

import { render } from '@testing-library/react';
import React from 'react';
import Avatar from './Avatar';

describe('Test for Avatar component', () => {
  it('Component should render avatar properly', () => {
    const { getByTestId } = render(<Avatar name="Avatar1" />);

    const avatar = getByTestId('avatar');

    expect(avatar).toBeInTheDocument();
  });

  it('Component should render avatar properly for type circle', () => {
    const { getByTestId } = render(
      <Avatar
        className=""
        name="Avatar1"
        textClass=""
        type="circle"
        width="36"
      />
    );

    const avatar = getByTestId('avatar');

    expect(avatar).toBeInTheDocument();
  });
});
