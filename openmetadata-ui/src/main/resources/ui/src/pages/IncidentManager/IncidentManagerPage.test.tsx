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
import IncidentManagerPage from './IncidentManagerPage';

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock('../../components/IncidentManager/IncidentManager.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>IncidentManager.component</div>);
});

describe('IncidentManagerPage', () => {
  it('should render component', async () => {
    render(<IncidentManagerPage />);

    expect(await screen.findByTestId('page-title')).toBeInTheDocument();
    expect(await screen.findByTestId('page-sub-title')).toBeInTheDocument();

    expect(
      await screen.findByText('IncidentManager.component')
    ).toBeInTheDocument();
  });
});
