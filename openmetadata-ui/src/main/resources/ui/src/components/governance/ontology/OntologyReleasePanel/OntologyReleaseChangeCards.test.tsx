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
import {
  ChangeType,
  MemberKind,
} from '../../../../generated/api/data/ontologyWorkingDiff';
import OntologyReleaseChangeCards from './OntologyReleaseChangeCards';
import { ChangeRow } from './OntologyReleaseChanges.utils';

const propertyRows = (count: number): ChangeRow[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `property-${index}`,
    kind: 'properties',
    changeType: ChangeType.Added,
    member: {
      memberKind: MemberKind.Property,
      changeType: ChangeType.Added,
      ontologyId: 'ontology',
      entity: {
        id: `property-${index}`,
        name: `property-${index}`,
        type: 'ontologyProperty',
      },
    },
  }));

const renderCards = (count: number) =>
  render(
    <OntologyReleaseChangeCards
      cards={[{ kind: 'properties', rows: propertyRows(count) }]}
    />
  );

const shownRows = () =>
  within(screen.getByTestId('ontology-change-card-properties')).getAllByRole(
    'listitem'
  );

describe('OntologyReleaseChangeCards', () => {
  it('shows 30 rows and loads 30 more on each Load more', () => {
    renderCards(65);

    expect(shownRows()).toHaveLength(30);
    expect(screen.getByText('label.kg-showing-of')).toBeInTheDocument();

    const loadMore = screen.getByTestId(
      'ontology-change-card-properties-load-more'
    );
    fireEvent.click(loadMore);

    expect(shownRows()).toHaveLength(60);

    fireEvent.click(loadMore);

    expect(shownRows()).toHaveLength(65);
    expect(
      screen.queryByTestId('ontology-change-card-properties-load-more')
    ).not.toBeInTheDocument();
  });

  it('shows every row without Load more when the card fits one page', () => {
    renderCards(30);

    expect(shownRows()).toHaveLength(30);
    expect(
      screen.queryByTestId('ontology-change-card-properties-load-more')
    ).not.toBeInTheDocument();
  });
});
