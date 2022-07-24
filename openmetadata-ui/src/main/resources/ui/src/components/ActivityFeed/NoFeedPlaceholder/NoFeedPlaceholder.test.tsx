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

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import NoFeedPlaceholder from './NoFeedPlaceholder';

describe('Test NoFeedPlaceholder Component', () => {
  it('Should render all child elements', async () => {
    const { container } = render(<NoFeedPlaceholder entityName="zyx" />, {
      wrapper: MemoryRouter,
    });

    const placeHolderContainer = await findByTestId(
      container,
      'placeholder-container'
    );

    const placeholderMessage = await findByTestId(
      container,
      'placeholder-message'
    );

    const placeHolderIcon = await findByTestId(container, 'placeholder-icon');

    const placeHolderImage = await findByTestId(container, 'placeholder-image');

    expect(placeHolderContainer).toBeInTheDocument();
    expect(placeholderMessage).toBeInTheDocument();
    expect(placeHolderIcon).toBeInTheDocument();
    expect(placeHolderImage).toBeInTheDocument();

    expect(
      await findByTestId(placeHolderImage, 'editor-image')
    ).toBeInTheDocument();
  });
});
