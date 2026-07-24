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

import { Provenance, Status } from '../generated/api/data/updateTermRelation';
import {
  getOntologyStudioAssets,
  getOntologyStudioDataGraph,
  getOntologyStudioSummary,
  removeTermRelationById,
  updateTermRelationById,
} from './glossaryAPI';
import APIClient from './index';

jest.mock('./index', () => ({
  delete: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

const mockedApiClient = APIClient as jest.Mocked<typeof APIClient>;

describe('glossaryAPI stable relationship operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates exactly one relationship by its stable ID', async () => {
    const update = {
      provenance: Provenance.Imported,
      relationType: 'partOf',
      status: Status.Approved,
    };
    const response = { data: { id: 'term-id' } };
    mockedApiClient.put.mockResolvedValue(response);

    const result = await updateTermRelationById(
      'term-id',
      'relationship-id',
      update
    );

    expect(mockedApiClient.put).toHaveBeenCalledWith(
      '/glossaryTerms/term-id/relations/id/relationship-id',
      update
    );
    expect(result).toEqual(response.data);
  });

  it('deletes exactly one relationship by its stable ID', async () => {
    const response = { data: { id: 'term-id' } };
    mockedApiClient.delete.mockResolvedValue(response);

    const result = await removeTermRelationById('term-id', 'relationship-id');

    expect(mockedApiClient.delete).toHaveBeenCalledWith(
      '/glossaryTerms/term-id/relations/id/relationship-id'
    );
    expect(result).toEqual(response.data);
  });

  it('uses typed bounded Ontology Studio routes', async () => {
    const controller = new AbortController();
    mockedApiClient.get
      .mockResolvedValueOnce({ data: { totalTerms: 3 } })
      .mockResolvedValueOnce({ data: { clusters: [] } })
      .mockResolvedValueOnce({ data: { data: [], paging: { total: 0 } } });

    await getOntologyStudioSummary(
      { limit: 5, offset: 0, parent: 'Commerce' },
      controller.signal
    );
    await getOntologyStudioDataGraph({
      assetPreviewSize: 4,
      limit: 12,
      offset: 0,
      parent: 'Commerce',
    });
    await getOntologyStudioAssets('term-id', 6, 4, controller.signal);

    expect(mockedApiClient.get).toHaveBeenNthCalledWith(
      1,
      '/glossaryTerms/studio/summary',
      {
        params: { limit: 5, offset: 0, parent: 'Commerce' },
        signal: controller.signal,
      }
    );
    expect(mockedApiClient.get).toHaveBeenNthCalledWith(
      2,
      '/glossaryTerms/studio/data',
      {
        params: {
          assetPreviewSize: 4,
          limit: 12,
          offset: 0,
          parent: 'Commerce',
        },
        signal: undefined,
      }
    );
    expect(mockedApiClient.get).toHaveBeenNthCalledWith(
      3,
      '/glossaryTerms/term-id/studioAssets',
      {
        params: { limit: 6, offset: 4 },
        signal: controller.signal,
      }
    );
  });
});
