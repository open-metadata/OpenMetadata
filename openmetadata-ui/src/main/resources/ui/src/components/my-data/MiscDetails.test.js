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

import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { miscDetailsData } from '../MyData/MyData.mock';
import MiscDetails from './MiscDetails';

describe('Test MiscDetails Component', () => {
  const { testdata1, testdata2, testdata3 } = miscDetailsData;

  it('Renders the proper HTML with seperator', () => {
    const { title, text, separator } = testdata1;
    const { container } = render(
      <MiscDetails addSeparator={separator} text={text} title={title} />
    );
    const textElement = getByTestId(container, 'text');
    const titleElement = getByTestId(container, 'title');
    const separatorElement = getByTestId(container, 'separator');

    expect(textElement.textContent).toBe('Shops Org');
    expect(titleElement.textContent).toBe('Owner :');
    expect(separatorElement).toBeInTheDocument();
  });

  it('Renders the proper HTML without separator', () => {
    const { title, text, separator } = testdata2;
    const { queryByTestId, container } = render(
      <MiscDetails addSeparator={separator} text={text} title={title} />
    );

    expect(queryByTestId('separator')).toBeNull();

    const textElement = getByTestId(container, 'text');
    const titleElement = getByTestId(container, 'title');

    expect(textElement.textContent).toBe('HIVE');
    expect(titleElement.textContent).toBe('Platform :');
  });

  it('Renders the proper HTML for default data for separator', () => {
    const { title, text } = testdata3;
    const { container } = render(<MiscDetails text={text} title={title} />);
    const textElement = getByTestId(container, 'text');
    const titleElement = getByTestId(container, 'title');
    const separatorElement = getByTestId(container, 'separator');

    expect(textElement.textContent).toBe('Tier1');
    expect(titleElement.textContent).toBe('Tier :');
    expect(separatorElement).toBeInTheDocument();
  });
});
