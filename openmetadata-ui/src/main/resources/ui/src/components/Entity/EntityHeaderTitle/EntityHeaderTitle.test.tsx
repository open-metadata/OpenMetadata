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
import { MemoryRouter } from 'react-router-dom';
import EntityHeaderTitle from './EntityHeaderTitle.component';

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: '/explore' }));
});

describe('EntityHeaderTitle', () => {
  it('should render icon', () => {
    render(
      <EntityHeaderTitle
        displayName="Test DisplayName"
        icon="test-icon"
        name="test-name"
        serviceName="sample-data"
      />
    );

    expect(screen.getByText('test-icon')).toBeInTheDocument();
  });

  it('should render name', () => {
    render(
      <EntityHeaderTitle
        displayName="Test DisplayName"
        icon="test-icon"
        name="test-name"
        serviceName="sample-data"
      />
    );

    expect(screen.getByText('test-name')).toBeInTheDocument();
  });

  it('should render displayName', () => {
    render(
      <EntityHeaderTitle
        displayName="Test DisplayName"
        icon="test-icon"
        name="test-name"
        serviceName="sample-data"
      />
    );

    expect(screen.getByText('Test DisplayName')).toBeInTheDocument();
  });

  it('should render link if link is provided', () => {
    render(
      <EntityHeaderTitle
        displayName="Test DisplayName"
        icon="test-icon"
        link="test-link"
        name="test-name"
        serviceName="sample-data"
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByTestId('entity-link')).toHaveProperty(
      'href',
      'http://localhost/test-link'
    );
  });
});
