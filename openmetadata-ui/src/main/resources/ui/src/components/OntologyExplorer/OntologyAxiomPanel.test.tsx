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
import OntologyAxiomPanel from './OntologyAxiomPanel';

jest.mock(
  '../governance/ontology/OntologyPicker/OntologyPicker',
  () =>
    ({ onChange }: { onChange: (value: { id: string }) => void }) =>
      <button onClick={() => onChange({ id: 'native' })}>select</button>
);
jest.mock(
  '../governance/ontology/OntologyAxiomWorkspace/OntologyAxiomWorkspace',
  () =>
    ({ ontology }: { ontology: { id: string } }) =>
      <span>{ontology.id}</span>
);

it('selects a native ontology before opening the formal axiom workbench', () => {
  render(<OntologyAxiomPanel />);

  expect(screen.queryByText('native')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'select' }));

  expect(screen.getByText('native')).toBeInTheDocument();
});
