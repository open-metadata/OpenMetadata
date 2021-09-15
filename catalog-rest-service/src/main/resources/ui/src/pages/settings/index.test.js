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
import SettingsPage from './index';

jest.mock('../../components/containers/PageContainer', () => ({ children }) => (
  <div data-testid="PageContainer">{children}</div>
));

describe('Test Settings page', () => {
  it('Check for heading', async () => {
    const { findByText } = render(<SettingsPage />);
    const heading = await findByText(/Settings/);

    expect(heading).toBeInTheDocument();
  });

  it('Pagecontainer should be there', async () => {
    const { findByTestId } = render(<SettingsPage />);
    const pageContainer = await findByTestId('PageContainer');

    expect(pageContainer).toBeInTheDocument();
  });
});
