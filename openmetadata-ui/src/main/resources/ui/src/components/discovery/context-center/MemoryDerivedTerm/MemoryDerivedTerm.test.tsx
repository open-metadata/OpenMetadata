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
import { MemoryRouter } from 'react-router-dom';
import { ContextMemory } from '../../../../generated/entity/context/contextMemory';
import MemoryDerivedTerm from './MemoryDerivedTerm';

const memory = (derivedEntities: ContextMemory['derivedEntities']) =>
  ({
    id: 'memory-id',
    name: 'churn-memory',
    derivedEntities,
  } as ContextMemory);

describe('MemoryDerivedTerm', () => {
  it('links the glossary terms derived from the memory', () => {
    const onNavigate = jest.fn();
    render(
      <MemoryRouter>
        <MemoryDerivedTerm
          isViewOnly
          memory={memory([
            {
              id: 'term-id',
              type: 'glossaryTerm',
              name: 'churn',
              displayName: 'Churn',
              fullyQualifiedName: 'Business.churn',
            },
            {
              id: 'concept-id',
              type: 'ontologyConcept',
              name: 'Churn',
              fullyQualifiedName: 'Model.Churn',
            },
          ])}
          onNavigate={onNavigate}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('memory-derived-term')).toHaveTextContent(
      'label.derived-term'
    );

    const link = screen.getByRole('link', { name: 'Churn' });

    expect(link).toHaveAttribute('href', '/glossary/Business.churn');
    expect(screen.getAllByRole('link')).toHaveLength(1);

    fireEvent.click(link);

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('renders derived terms as plain text while the memory is being edited', () => {
    const onNavigate = jest.fn();
    render(
      <MemoryRouter>
        <MemoryDerivedTerm
          isViewOnly={false}
          memory={memory([
            {
              id: 'term-id',
              type: 'glossaryTerm',
              name: 'churn',
              displayName: 'Churn',
              fullyQualifiedName: 'Business.churn',
            },
          ])}
          onNavigate={onNavigate}
        />
      </MemoryRouter>
    );

    const section = screen.getByTestId('memory-derived-term');

    expect(section).toHaveTextContent('label.derived-term');
    expect(section).toHaveTextContent('Churn');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    fireEvent.click(within(section).getByText('Churn'));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('renders nothing when no glossary term came from the memory', () => {
    const { container } = render(
      <MemoryRouter>
        <MemoryDerivedTerm
          isViewOnly
          memory={memory([])}
          onNavigate={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
