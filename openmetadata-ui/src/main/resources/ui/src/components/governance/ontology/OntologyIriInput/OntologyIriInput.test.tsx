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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import OntologyIriInput from './OntologyIriInput';

const Harness = ({ initial = '' }: { initial?: string }) => {
  const [value, setValue] = useState(initial);

  return (
    <>
      <OntologyIriInput
        label="Subject"
        options={[
          { iri: 'urn:Customer', label: 'Customer' },
          { iri: 'urn:Person', label: 'Person' },
        ]}
        value={value}
        onChange={setValue}
      />
      <output data-testid="stored-iri">{value}</output>
    </>
  );
};

it('finds a concept by label and stores its exact IRI', async () => {
  render(<Harness />);
  const input = screen.getByRole('combobox', { name: /Subject/ });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Pers' } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: /Person/ }));
  await waitFor(() =>
    expect(screen.getByTestId('stored-iri')).toHaveTextContent('urn:Person')
  );

  expect(input).toHaveValue('Person');
});

it('retains an external IRI and accepts edits without requiring a local declaration', () => {
  render(<Harness initial="https://example.test/External" />);
  const input = screen.getByRole('combobox', { name: /Subject/ });

  expect(input).toHaveValue('https://example.test/External');

  fireEvent.change(input, { target: { value: 'https://example.test/Other' } });
  fireEvent.blur(input);

  expect(screen.getByTestId('stored-iri')).toHaveTextContent(
    'https://example.test/Other'
  );
});
