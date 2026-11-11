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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ChangeType,
  MemberKind,
} from '../../../../generated/api/data/ontologyReleaseDiff';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { getOntologyReleaseDiff } from '../../../../rest/ontologyAPI';
import OntologyReleaseCompare from './OntologyReleaseCompare';

jest.mock('../../../../rest/ontologyAPI', () => ({
  getOntologyReleaseDiff: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));
// The real picker is a remote tree; each test drives the pair it needs.
jest.mock(
  '../OntologyReleasePicker/OntologyReleasePicker',
  () =>
    ({
      label,
      onChange,
    }: {
      label: string;
      onChange: (release: OntologyRelease) => void;
    }) => {
      const releases: Record<string, unknown> = {
        'label.compare-from-version': { id: 'one', semanticVersion: '1.0.0' },
        'label.compare-to-version': { id: 'two', semanticVersion: '1.1.0' },
      };

      return (
        <button
          data-testid={label}
          onClick={() => onChange(releases[label] as OntologyRelease)}>
          {label}
        </button>
      );
    }
);

const change = (
  name: string,
  changeType: ChangeType,
  memberKind = MemberKind.Concept
) => ({
  changeType,
  memberKind,
  ontologyId: 'o',
  entity: { id: name, type: 'ontologyConcept', name },
});

const renderCompare = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OntologyReleaseCompare ontologyId="o" />
    </QueryClientProvider>
  );

const pickBoth = () => {
  fireEvent.click(screen.getByTestId('label.compare-from-version'));
  fireEvent.click(screen.getByTestId('label.compare-to-version'));
};

describe('Compare versions', () => {
  beforeEach(() => (getOntologyReleaseDiff as jest.Mock).mockReset());

  it('asks for two versions before comparing', () => {
    renderCompare();

    expect(screen.getByText('message.ontology-compare-pick-two')).toBeVisible();
    expect(getOntologyReleaseDiff).not.toHaveBeenCalled();
  });

  it('lists added, changed and removed concepts between the two releases', async () => {
    (getOntologyReleaseDiff as jest.Mock).mockResolvedValue({
      data: [
        change('Invoice', ChangeType.Added),
        change('Customer', ChangeType.Changed),
        change('Legacy', ChangeType.Removed),
        change('Ontology root', ChangeType.Changed, MemberKind.Ontology),
        change('hasOwner', ChangeType.Added, MemberKind.Association),
      ],
      paging: { total: 5 },
    });
    renderCompare();
    pickBoth();

    const added = await screen.findByTestId('ontology-compare-added');

    expect(added).toHaveTextContent('Invoice');
    expect(added).toHaveTextContent('hasOwner');
    expect(screen.getByTestId('ontology-compare-changed')).toHaveTextContent(
      'Customer'
    );
    expect(
      screen.getByTestId('ontology-compare-changed')
    ).not.toHaveTextContent('Ontology root');
    expect(screen.getByTestId('ontology-compare-removed')).toHaveTextContent(
      'Legacy'
    );
    expect(screen.getByTestId('ontology-compare-counts')).toHaveTextContent(
      'message.ontology-change-total {"count":4}'
    );
    expect(getOntologyReleaseDiff).toHaveBeenCalledWith(
      'two',
      { baseReleaseId: 'one', limit: 500, after: undefined },
      expect.anything()
    );
  });

  it('says there are no differences when the releases hold the same content', async () => {
    (getOntologyReleaseDiff as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    renderCompare();
    pickBoth();

    expect(
      await screen.findByTestId('ontology-compare-empty')
    ).toHaveTextContent(
      'message.ontology-compare-no-differences {"from":"1.0.0","to":"1.1.0"}'
    );
  });

  it('offers more results when the diff has another page', async () => {
    (getOntologyReleaseDiff as jest.Mock).mockResolvedValue({
      data: [change('Invoice', ChangeType.Added)],
      paging: { total: 600, after: 'cursor' },
    });
    renderCompare();
    pickBoth();

    expect(await screen.findByText(/label.kg-showing-of/)).toHaveTextContent(
      '{"shown":1,"total":600}'
    );
    expect(screen.getByText('label.load-more')).toBeVisible();
  });
});
