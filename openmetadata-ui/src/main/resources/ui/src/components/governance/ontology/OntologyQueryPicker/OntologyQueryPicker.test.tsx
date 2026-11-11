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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  useOntologyConceptCounts,
  useOntologyPropertyCounts,
} from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import OntologyQueryPicker from './OntologyQueryPicker';

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioScopes',
  () => ({
    useOntologyConceptCounts: jest.fn(),
    useOntologyPropertyCounts: jest.fn(),
  })
);

const ontology = (id: string, name: string): Ontology =>
  ({ id, name, displayName: name, fullyQualifiedName: name } as Ontology);

const CLINICAL = ontology('o-1', 'Clinical');
const RETAIL = ontology('o-2', 'Retail');

describe('OntologyQueryPicker', () => {
  beforeEach(() => {
    (useOntologyConceptCounts as jest.Mock).mockReturnValue({
      'o-1': 12,
      'o-2': 1,
    });
    (useOntologyPropertyCounts as jest.Mock).mockReturnValue({ 'o-1': 3 });
  });

  it('explains that a query runs against one ontology and lists each with its counts', () => {
    render(
      <OntologyQueryPicker
        ontologies={[CLINICAL, RETAIL]}
        surface="console"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByTestId('ontology-query-picker-title')).toHaveTextContent(
      'message.query-choose-ontology-title'
    );
    expect(
      screen.getByTestId('ontology-query-picker-description')
    ).toHaveTextContent('message.query-choose-ontology-console');
    expect(
      within(
        screen.getByTestId('ontology-query-picker-option-o-1')
      ).getByTestId('ontology-query-picker-counts')
    ).toHaveTextContent(
      /^12 label\.concept-plural · 3 label\.property-plural$/
    );
  });

  it('uses the singular for one concept and leaves out a count that has not loaded', () => {
    render(
      <OntologyQueryPicker
        ontologies={[CLINICAL, RETAIL]}
        surface="console"
        onSelect={jest.fn()}
      />
    );

    expect(
      within(
        screen.getByTestId('ontology-query-picker-option-o-2')
      ).getByTestId('ontology-query-picker-counts')
    ).toHaveTextContent(/^1 label\.concept$/);
  });

  it('describes the builder when the builder is the surface', () => {
    render(
      <OntologyQueryPicker
        ontologies={[CLINICAL]}
        surface="builder"
        onSelect={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('ontology-query-picker-description')
    ).toHaveTextContent('message.query-choose-ontology-builder');
  });

  it('hands the chosen ontology to the page', () => {
    const onSelect = jest.fn();
    render(
      <OntologyQueryPicker
        ontologies={[CLINICAL, RETAIL]}
        surface="console"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByTestId('ontology-query-picker-option-o-2'));

    expect(onSelect).toHaveBeenCalledWith(RETAIL);
  });
});
