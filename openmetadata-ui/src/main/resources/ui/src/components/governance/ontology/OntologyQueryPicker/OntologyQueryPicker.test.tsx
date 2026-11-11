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
import userEvent from '@testing-library/user-event';
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

const openPicker = async (text: string) => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.type(screen.getByRole('combobox'), text);

  return user;
};

describe('OntologyQueryPicker', () => {
  beforeEach(() => {
    (useOntologyConceptCounts as jest.Mock).mockReturnValue({
      'o-1': 12,
      'o-2': 1,
    });
    (useOntologyPropertyCounts as jest.Mock).mockReturnValue({ 'o-1': 3 });
  });

  it('explains that a query runs against one ontology and lists each with its counts', async () => {
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

    await openPicker('Clin');

    expect(
      await screen.findByTestId('ontology-query-picker-option-o-1')
    ).toHaveTextContent(/12 label\.concept-plural · 3 label\.property-plural/);
  });

  it('uses the singular for one concept and leaves out a count that has not loaded', async () => {
    render(
      <OntologyQueryPicker
        ontologies={[CLINICAL, RETAIL]}
        surface="console"
        onSelect={jest.fn()}
      />
    );

    await openPicker('Ret');
    const option = await screen.findByTestId(
      'ontology-query-picker-option-o-2'
    );

    expect(option).toHaveTextContent(/1 label\.concept$/);
    expect(option).not.toHaveTextContent('label.property');
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

  it('asks which ontology to review on the Ontology view', () => {
    render(
      <OntologyQueryPicker
        ontologies={[CLINICAL]}
        surface="ontology"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByTestId('ontology-query-picker-title')).toHaveTextContent(
      'message.ontology-choose-ontology-to-review'
    );
    expect(
      screen.getByTestId('ontology-query-picker-description')
    ).toHaveTextContent('message.ontology-view-works-on-one-ontology');
  });

  it('hands the chosen ontology to the page', async () => {
    const onSelect = jest.fn();
    render(
      <OntologyQueryPicker
        ontologies={[CLINICAL, RETAIL]}
        surface="console"
        onSelect={onSelect}
      />
    );

    const user = await openPicker('Ret');
    await user.click(
      await screen.findByTestId('ontology-query-picker-option-o-2')
    );

    expect(onSelect).toHaveBeenCalledWith(RETAIL);
  });
});
