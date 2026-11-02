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
import { EntityStatus } from '../../../../generated/entity/data/ontologyRelease';
import OntologyReleaseHistory from './OntologyReleaseHistory';

jest.mock('../../../../hooks/useAppMode', () => ({
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('./OntologyReleaseExport', () => () => null);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const release = (
  id: string,
  semanticVersion: string,
  entityStatus: EntityStatus,
  reviewTask?: string
) => ({
  id,
  semanticVersion,
  entityStatus,
  reviewTask,
  releaseRevision: 1,
  sealedAt: 1,
  sealedBy: 'admin',
});

const history = (releases: ReturnType<typeof release>[]) =>
  ({
    isPending: false,
    isError: false,
    isSuccess: true,
    hasNextPage: false,
    data: { pages: [{ data: releases, paging: { total: releases.length } }] },
  } as never);

describe('Releases tab', () => {
  it('lists only the latest draft when older drafts have no review task', () => {
    render(
      <OntologyReleaseHistory
        history={history([
          release('d3', '1.0.0', EntityStatus.Draft),
          release('d2', '0.1.0', EntityStatus.Draft),
          release('d1', '0.0.1', EntityStatus.Draft),
        ])}
        latestReleaseId="d3"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByTestId('ontology-release-select-d3')).toHaveTextContent(
      '1.0.0'
    );
    expect(screen.queryByTestId('ontology-release-select-d2')).toBeNull();
    expect(screen.queryByTestId('ontology-release-select-d1')).toBeNull();
  });

  it('keeps an older draft that has a review task', () => {
    render(
      <OntologyReleaseHistory
        history={history([
          release('d2', '1.0.0', EntityStatus.Draft),
          release('d1', '0.1.0', EntityStatus.InReview, 'task'),
        ])}
        latestReleaseId="d2"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByTestId('ontology-release-select-d2')).toBeVisible();
    expect(screen.getByTestId('ontology-release-select-d1')).toBeVisible();
  });
});
