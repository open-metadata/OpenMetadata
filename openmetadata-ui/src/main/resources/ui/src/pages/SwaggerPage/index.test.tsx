/*
 *  Copyright 2024 Collate.
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
import SwaggerPage from './index';

jest.mock('./RapiDocReact', () => {
  return jest.fn().mockImplementation((props) => (
    <div>
      <p>RapiDocReact.component</p>
      <p>{props['api-key-value']}</p>
    </div>
  ));
});

jest.mock('../../utils/LocalStorageUtils', () => ({
  getOidcToken: jest.fn().mockReturnValue('fakeToken'),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    theme: {
      primaryColor: '#9c27b0',
    },
  })),
}));

describe('SwaggerPage component', () => {
  it('renders SwaggerPage component correctly', async () => {
    render(<SwaggerPage />);

    expect(await screen.findByTestId('fluid-container')).toBeInTheDocument();
    expect(
      await screen.findByText('RapiDocReact.component')
    ).toBeInTheDocument();
    expect(await screen.findByText('Bearer fakeToken')).toBeInTheDocument();
  });
});
