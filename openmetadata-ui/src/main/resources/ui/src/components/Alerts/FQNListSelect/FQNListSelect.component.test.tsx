/*
 *  Copyright 2025 Collate.
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

import { render, screen, waitFor } from '@testing-library/react';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import FQNListSelect, { resolveWildcardFqns } from './FQNListSelect.component';

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedProps: any;
jest.mock('../../common/AsyncSelect/AsyncSelect', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AsyncSelect: (props: any) => {
    capturedProps = props;

    return <div data-testid="async-select" />;
  },
}));

const mockSearchQuery = searchQuery as jest.Mock;

describe('resolveWildcardFqns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns only the FQNs whose entityType is a container type', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              fullyQualifiedName: 'svc',
              entityType: 'databaseService',
            },
          },
          {
            _source: {
              fullyQualifiedName: 'svc.db.schema.tbl',
              entityType: 'table',
            },
          },
        ],
      },
    });

    const result = await resolveWildcardFqns(
      ['svc', 'svc.db.schema.tbl'],
      SearchIndex.TABLE,
      ['databaseService', 'database', 'databaseSchema']
    );

    expect(result).toEqual(['svc']);
  });

  it('queries the exact-match "fullyQualifiedName" field, not a ".keyword" subfield', async () => {
    mockSearchQuery.mockResolvedValue({ hits: { hits: [] } });

    await resolveWildcardFqns(['svc'], SearchIndex.TABLE, ['databaseService']);

    const filter = JSON.stringify(mockSearchQuery.mock.calls[0][0].queryFilter);

    expect(filter).toContain('"fullyQualifiedName":"svc"');
    expect(filter).not.toContain('fullyQualifiedName.keyword');
  });

  it('does not call search when fqns or containerEntities are empty', async () => {
    expect(
      await resolveWildcardFqns([], SearchIndex.TABLE, ['databaseService'])
    ).toEqual([]);
    expect(await resolveWildcardFqns(['svc'], SearchIndex.TABLE, [])).toEqual(
      []
    );
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('returns an empty list when the search fails', async () => {
    mockSearchQuery.mockRejectedValue(new Error('boom'));

    expect(
      await resolveWildcardFqns(['svc'], SearchIndex.TABLE, ['databaseService'])
    ).toEqual([]);
  });
});

describe('FQNListSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedProps = undefined;
  });

  it('decorates container FQNs with ".*" and renders leaves plain', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              fullyQualifiedName: 'svc',
              entityType: 'databaseService',
            },
          },
        ],
      },
    });

    render(
      <FQNListSelect
        api={jest.fn()}
        containerEntities={['databaseService']}
        mode="multiple"
        searchIndex={SearchIndex.TABLE}
        value={['svc', 'svc.db.schema.tbl']}
      />
    );

    await screen.findByTestId('async-select');

    await waitFor(() => {
      const containerTag = render(
        capturedProps.tagRender({
          value: 'svc',
          closable: true,
          onClose: jest.fn(),
        })
      );

      expect(containerTag.getByText('svc.*')).toBeInTheDocument();
      expect(
        containerTag.getByText('svc.*').closest('[title]')
      ).toHaveAttribute('title', 'svc.*');
    });

    const leafTag = render(
      capturedProps.tagRender({
        value: 'svc.db.schema.tbl',
        closable: true,
        onClose: jest.fn(),
      })
    );

    expect(leafTag.getByText('svc.db.schema.tbl')).toBeInTheDocument();
  });

  it('renders all tags plain when there are no container entities', async () => {
    render(
      <FQNListSelect
        api={jest.fn()}
        containerEntities={[]}
        mode="multiple"
        searchIndex={SearchIndex.TABLE}
        value={['svc']}
      />
    );

    await screen.findByTestId('async-select');

    const tag = render(
      capturedProps.tagRender({
        value: 'svc',
        closable: true,
        onClose: jest.fn(),
      })
    );

    expect(tag.getByText('svc')).toBeInTheDocument();
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });
});
