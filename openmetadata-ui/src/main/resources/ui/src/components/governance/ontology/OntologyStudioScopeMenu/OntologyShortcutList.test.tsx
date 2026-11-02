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
import { Ontology } from '../../../../generated/entity/data/ontology';
import OntologyShortcutList from './OntologyShortcutList';

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioScopes',
  () => ({
    useOntologyConceptCounts: jest.fn().mockReturnValue({ a: 12, b: 1 }),
  })
);

const ontologies = [
  { id: 'a', name: 'alpha', displayName: 'Alpha Model' },
  { id: 'b', name: 'beta' },
] as Ontology[];

it('shows each ontology with its concept count and filters by what is typed', () => {
  const onSelect = jest.fn();
  render(<OntologyShortcutList ontologies={ontologies} onSelect={onSelect} />);

  expect(screen.getByTestId('ontology-shortcut-a')).toHaveTextContent(
    'Alpha Model12 label.concept-plural'
  );
  expect(screen.getByTestId('ontology-shortcut-b')).toHaveTextContent(
    'beta1 label.concept-plural'
  );

  fireEvent.change(screen.getByTestId('ontology-shortcut-search'), {
    target: { value: 'ALP' },
  });

  expect(screen.queryByTestId('ontology-shortcut-b')).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('ontology-shortcut-a'));

  expect(onSelect).toHaveBeenCalledWith(ontologies[0]);
});

it('says when nothing matches the search', () => {
  render(<OntologyShortcutList ontologies={ontologies} onSelect={jest.fn()} />);
  fireEvent.change(screen.getByTestId('ontology-shortcut-search'), {
    target: { value: 'zzz' },
  });

  expect(screen.getByText('message.ontology-picker-no-match')).toBeVisible();
});
