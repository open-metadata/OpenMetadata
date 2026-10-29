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
import { fireEvent, render, screen } from '@testing-library/react';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import OntologyStudioHeader from './OntologyStudioHeader';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

const modes = [
  { id: 'view', label: 'View' },
  { id: 'edit', label: 'Edit' },
  { id: 'query', label: 'Query' },
];

const renderHeader = (onModeChange = jest.fn()) =>
  render(
    <OntologyStudioHeader
      actions={<button data-testid="header-action">Publish</button>}
      breadcrumb={<span data-testid="header-breadcrumb">Crumb</span>}
      mode="view"
      modes={modes}
      scopeMenu={<button data-testid="header-scope">All ontologies</button>}
      onModeChange={onModeChange}
    />
  );

describe('OntologyStudioHeader', () => {
  afterEach(() => {
    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it.each([false, true])(
    'renders scope menu, actions, breadcrumb and every mode tab (AI mode: %s)',
    (isAiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);
      renderHeader();

      expect(screen.getByTestId('header-scope')).toBeInTheDocument();
      expect(screen.getByTestId('header-action')).toBeInTheDocument();
      expect(screen.getByTestId('header-breadcrumb')).toBeInTheDocument();

      modes.forEach(({ id }) =>
        expect(screen.getByTestId(`mode-tab-${id}`)).toBeInTheDocument()
      );
    }
  );

  it('shows the studio description only in AI mode', () => {
    renderHeader();

    expect(
      screen.queryByText('message.ontology-studio-description')
    ).not.toBeInTheDocument();

    (useIsAiMode as jest.Mock).mockReturnValue(true);
    renderHeader();

    expect(
      screen.getByText('message.ontology-studio-description')
    ).toBeInTheDocument();
  });

  it('switches mode from the AI-mode tabs', () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const onModeChange = jest.fn();
    renderHeader(onModeChange);

    fireEvent.click(screen.getByTestId('mode-tab-edit'));

    expect(onModeChange).toHaveBeenCalledWith('edit');
  });
});
