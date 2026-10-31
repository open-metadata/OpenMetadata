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
import { OntologyIriOption } from './OntologyIriInput.types';

const OPTIONS = [
  { iri: 'urn:Customer', label: 'Customer' },
  { iri: 'urn:Person', label: 'Person' },
];

const Harness = ({
  initial = '',
  options = OPTIONS,
}: {
  initial?: string;
  options?: OntologyIriOption[];
}) => {
  const [value, setValue] = useState(initial);

  return (
    <>
      <OntologyIriInput
        label="Subject"
        options={options}
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

it.each(['Customer', 'customer', ' CUSTOMER '])(
  'resolves the typed exact label %s without selecting a menu item',
  (label) => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: /Subject/ });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: label } });
    fireEvent.blur(input);

    expect(screen.getByTestId('stored-iri')).toHaveTextContent('urn:Customer');
    expect(input).toHaveValue('Customer');
  }
);

it('restores a selected IRI after editing and retyping its label', () => {
  render(<Harness initial="urn:Customer" />);
  const input = screen.getByRole('combobox', { name: /Subject/ });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Cust' } });
  fireEvent.change(input, { target: { value: 'Customer' } });
  fireEvent.blur(input);

  expect(screen.getByTestId('stored-iri')).toHaveTextContent('urn:Customer');
  expect(input).toHaveValue('Customer');
});

it('requires an explicit selection when more than one IRI has the same label', async () => {
  render(
    <Harness
      options={[
        { iri: 'urn:one:Customer', label: 'Customer' },
        { iri: 'urn:two:Customer', label: 'CUSTOMER' },
      ]}
    />
  );
  const input = screen.getByRole('combobox', { name: /Subject/ });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Customer' } });
  fireEvent.blur(input);

  expect(screen.getByTestId('stored-iri')).toHaveTextContent(/^Customer$/);

  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(
    await screen.findByRole('option', { name: 'CUSTOMER', exact: true })
  );

  expect(screen.getByTestId('stored-iri')).toHaveTextContent(
    'urn:two:Customer'
  );
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
