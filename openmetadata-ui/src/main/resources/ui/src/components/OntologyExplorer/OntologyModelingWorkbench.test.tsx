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
import { Glossary } from '../../generated/entity/data/glossary';
import OntologyModelingWorkbench from './OntologyModelingWorkbench';

jest.mock('./OntologyIriPreviewPanel', () => () => (
  <div data-testid="iri-panel" />
));
jest.mock('./OntologyPatternPanel', () => () => (
  <div data-testid="pattern-panel" />
));
jest.mock('./OntologySubsetPanel', () => () => (
  <div data-testid="subset-panel" />
));
jest.mock('./OntologyStructurePanel', () => () => (
  <div data-testid="structure-panel" />
));
jest.mock('./OntologyAxiomPanel', () => () => (
  <div data-testid="axiom-panel" />
));

const GLOSSARY: Glossary = {
  description: 'Governed concepts',
  id: 'glossary-id',
  name: 'GovernedGlossary',
};

describe('OntologyModelingWorkbench', () => {
  it('requires a selected glossary before authoring', () => {
    render(<OntologyModelingWorkbench glossaries={[GLOSSARY]} />);

    expect(
      screen.queryByTestId('ontology-modeling-workbench')
    ).not.toBeInTheDocument();
    expect(screen.getByText('label.select-entity')).toBeInTheDocument();
  });

  it('provides keyboard-accessible navigation across modeling surfaces', () => {
    render(
      <OntologyModelingWorkbench
        glossaries={[GLOSSARY]}
        selectedGlossary={GLOSSARY}
      />
    );

    expect(screen.getByTestId('iri-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-modeling-tab-patterns'));

    expect(screen.getByTestId('pattern-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-modeling-tab-subset'));

    expect(screen.getByTestId('subset-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-modeling-tab-merge'));

    expect(screen.getByTestId('structure-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-modeling-tab-axioms'));

    expect(screen.getByTestId('axiom-panel')).toBeInTheDocument();
  });
});
