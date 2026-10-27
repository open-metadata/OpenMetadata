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

import { fireEvent, screen } from '@testing-library/react';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyStudioScopeMenu from './OntologyStudioScopeMenu';

it('dispatches Edit, Create and Retry once without selecting a synthetic scope', () => {
  const onEditOntology = jest.fn(),
    onCreateOntology = jest.fn(),
    onRetry = jest.fn(),
    onScopeChange = jest.fn();
  renderWithQueryClient(
    <OntologyStudioScopeMenu
      isError
      glossaries={[]}
      label="Sales"
      ontologies={[]}
      scope={{ kind: 'allOntologies' }}
      onCreateOntology={onCreateOntology}
      onEditOntology={onEditOntology}
      onRetry={onRetry}
      onScopeChange={onScopeChange}
    />
  );
  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
  fireEvent.click(screen.getByTestId('ontology-edit-ontology'));

  expect(onEditOntology).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
  fireEvent.click(screen.getByTestId('ontology-create'));

  expect(onCreateOntology).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
  fireEvent.click(screen.getByText('label.retry'));

  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onScopeChange).not.toHaveBeenCalled();
});
