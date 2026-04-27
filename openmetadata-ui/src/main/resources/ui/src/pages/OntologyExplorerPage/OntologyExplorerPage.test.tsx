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
import React from 'react';
import OntologyExplorerPage from './OntologyExplorerPage';

const mockOntologyExplorer = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: jest
    .fn()
    .mockImplementation(({ children, 'data-testid': testId }) => (
      <span data-testid={testId}>{children}</span>
    )),
  Card: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
  Divider: jest.fn().mockImplementation(() => <hr />),
  Skeleton: jest.fn().mockImplementation(() => <div data-testid="skeleton" />),
  Typography: jest
    .fn()
    .mockImplementation(
      ({
        children,
        'data-testid': testId,
      }: {
        children: React.ReactNode;
        'data-testid'?: string;
      }) => <span data-testid={testId}>{children}</span>
    ),
}));

jest.mock('@untitledui/icons', () => ({
  Home02: () => <div>Home02</div>,
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div data-testid="breadcrumb" />),
  })
);

jest.mock('../../components/OntologyExplorer', () => ({
  OntologyExplorer: jest.fn((props) => {
    mockOntologyExplorer(props);

    return <div data-testid="ontology-explorer" />;
  }),
}));

describe('OntologyExplorerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders heading with beta badge and all page elements', () => {
    render(<OntologyExplorerPage />);

    expect(screen.getByTestId('heading')).toBeInTheDocument();
    expect(screen.getByTestId('beta-badge')).toBeInTheDocument();
    expect(screen.getByTestId('beta-badge')).toHaveTextContent('label.beta');
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('ontology-explorer')).toBeInTheDocument();
  });
});
