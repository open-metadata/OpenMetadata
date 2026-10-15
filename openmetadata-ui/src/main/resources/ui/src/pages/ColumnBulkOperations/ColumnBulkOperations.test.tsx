/*
 *  Copyright 2026 Collate.
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
import { useIsAiMode } from '../../hooks/useAppMode';
import ColumnBulkOperations from './ColumnBulkOperations.component';

jest.mock('../../hooks/useAppMode', () => ({
  useIsAiMode: jest.fn(),
}));

jest.mock('./ColumnGrid/ColumnGrid.component', () =>
  jest.fn(() => <div data-testid="column-grid" />)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }) => <div>{children}</div>)
);

const renderPage = (isAiMode: boolean) => {
  (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);

  return render(
    <MemoryRouter>
      <ColumnBulkOperations />
    </MemoryRouter>
  );
};

describe('ColumnBulkOperations', () => {
  it.each([
    ['AI', true],
    ['classic', false],
  ])('shows the Deprecated badge in %s mode', (_, isAiMode) => {
    renderPage(isAiMode);

    expect(screen.getByTestId('deprecated-badge')).toHaveTextContent(
      'label.deprecated'
    );
    expect(screen.getByTestId('column-grid')).toBeInTheDocument();
  });
});
