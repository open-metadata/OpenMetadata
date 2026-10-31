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
import { Glossary } from '../../../../generated/entity/data/glossary';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyStudioScopeMenu from './OntologyStudioScopeMenu';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioScopes',
  () => ({
    useOntologyConceptCounts: jest.fn().mockReturnValue({ 'ont-1': 8 }),
  })
);

const ontology = {
  id: 'ont-1',
  name: 'HL7',
  displayName: 'HL7 FHIR Starter',
} as Ontology;
const glossary = {
  id: 'glossary-1',
  name: 'Business',
  termCount: 4,
} as Glossary;

const renderMenu = (
  props: Partial<Parameters<typeof OntologyStudioScopeMenu>[0]> = {}
) => {
  const handlers = {
    onScopeChange: jest.fn(),
    onCreateOntology: jest.fn(),
    onRetry: jest.fn(),
  };
  render(
    <OntologyStudioScopeMenu
      glossaries={[glossary]}
      label="All ontologies"
      ontologies={[ontology]}
      scope={{ kind: 'allOntologies' }}
      {...handlers}
      {...props}
    />
  );
  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));

  return handlers;
};

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

describe('OntologyStudioScopeMenu in AI mode', () => {
  beforeEach(() => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('lists ontologies with concept counts and selects a scope', async () => {
    const { onScopeChange } = renderMenu();

    expect(
      await screen.findByTestId('ontology-scope-all-ontologies')
    ).toBeInTheDocument();
    expect(screen.getByText('8 label.concept-plural')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-scope-ont-1'));

    expect(onScopeChange).toHaveBeenCalledWith({
      kind: 'ontology',
      ontologyId: 'ont-1',
    });
  });

  it('keeps the new ontology, glossary, loading and retry entries', async () => {
    const { onCreateOntology, onRetry } = renderMenu({
      isError: true,
      isLoading: true,
      scope: { kind: 'glossaries' },
    });

    expect(await screen.findByText('label.loading')).toBeInTheDocument();
    expect(
      screen.getByTestId('ontology-scope-all-glossaries')
    ).toBeInTheDocument();
    expect(screen.getByTestId('glossary-1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.retry'));

    expect(onRetry).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
    fireEvent.click(await screen.findByTestId('ontology-create'));

    expect(onCreateOntology).toHaveBeenCalled();
  });
});
