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
      expect(
        screen.getByTestId('ontology-studio-beta-badge')
      ).toHaveTextContent('label.beta');

      modes.forEach(({ id }) =>
        expect(screen.getByTestId(`mode-tab-${id}`)).toBeInTheDocument()
      );
    }
  );

  it.each([false, true])(
    'shows the studio description (AI mode: %s)',
    (isAiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);
      renderHeader();

      expect(
        screen.getByText('message.ontology-studio-description')
      ).toBeInTheDocument();
    }
  );

  it.each([false, true])(
    'switches mode from the tabs (AI mode: %s)',
    (isAiMode) => {
      (useIsAiMode as jest.Mock).mockReturnValue(isAiMode);
      const onModeChange = jest.fn();
      renderHeader(onModeChange);

      fireEvent.click(screen.getByTestId('mode-tab-edit'));

      expect(onModeChange).toHaveBeenCalledWith('edit');
    }
  );
});
