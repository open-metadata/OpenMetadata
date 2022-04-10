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
import SuccessScreen from './SuccessScreen';

describe('Test SuccessScreen component', () => {
  it('SuccessScreen component should render', async () => {
    const { container } = render(
      <SuccessScreen showIngestionButton name="NewService" />
    );

    const succsessScreenContainer = await findByTestId(
      container,
      'success-screen-container'
    );
    const successIcon = await findByTestId(container, 'success-icon');
    const successLine = await findByTestId(container, 'success-line');
    const viewServiceBtn = await findByTestId(container, 'view-service-button');
    const addIngestionBtn = await findByTestId(
      container,
      'add-ingestion-button'
    );

    expect(succsessScreenContainer).toBeInTheDocument();
    expect(successIcon).toBeInTheDocument();
    expect(successLine).toBeInTheDocument();
    expect(viewServiceBtn).toBeInTheDocument();
    expect(addIngestionBtn).toBeInTheDocument();
  });
});
