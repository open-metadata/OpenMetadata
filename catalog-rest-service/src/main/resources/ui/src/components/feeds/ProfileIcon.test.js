/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { render } from '@testing-library/react';
import React from 'react';
import ProfileIcon from './ProfileIcon';

describe('Test ProfileIcon Component', () => {
  it('Should render img tag with given src', async () => {
    const { findByTestId } = render(
      <ProfileIcon imgSrc="dummy/src" title="img profile" />
    );
    const icon = await findByTestId(/image-profile/);

    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute('alt')).toBe('img profile');
  });

  it('Should render default svg', async () => {
    const { findByTestId } = render(<ProfileIcon title="svg icon" />);
    const icon = await findByTestId(/svg-profile/);

    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute('title')).toBe('svg icon');
  });
});
