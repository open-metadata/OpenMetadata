/*
 *  Copyright 2024 Collate.
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
import { Input } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import OntologySearchClearButton from './OntologySearchClearButton';

const SearchHarness = () => {
  const [value, setValue] = useState('');

  return (
    <Input
      aria-label="search"
      inputDataTestId="search"
      trailingSlot={
        <OntologySearchClearButton value={value} onClear={() => setValue('')} />
      }
      value={value}
      onChange={setValue}
    />
  );
};

describe('OntologySearchClearButton', () => {
  it('appears only while there is text and clears the search', () => {
    render(<SearchHarness />);
    const input = screen.getByTestId('search');

    expect(
      screen.queryByTestId('ontology-graph-search-clear')
    ).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'df' } });
    fireEvent.click(screen.getByTestId('ontology-graph-search-clear'));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(
      screen.queryByTestId('ontology-graph-search-clear')
    ).not.toBeInTheDocument();
  });
});
