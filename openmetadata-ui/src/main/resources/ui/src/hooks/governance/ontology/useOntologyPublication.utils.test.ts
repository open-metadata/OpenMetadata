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
import APIClient from '../../../rest/axiosClient';
import { latestVersionedOntologyRelease } from './useOntologyPublication.utils';

jest.mock('../../../rest/axiosClient', () => ({ get: jest.fn() }));
const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const signal = new AbortController().signal;

describe('latest versioned release lookup', () => {
  beforeEach(() => get.mockReset());

  it('continues past legacy candidates and uses the newest version even when rejected', async () => {
    const versioned = {
      id: 'rejected',
      ontology: { id: 'owner' },
      semanticVersion: '2.3.4',
      entityStatus: 'Rejected',
    };
    get.mockResolvedValueOnce({
      data: {
        data: [{ id: 'legacy', ontology: { id: 'owner' } }],
        paging: { after: '12', total: 2 },
      },
    });
    get.mockResolvedValueOnce({
      data: { data: [versioned], paging: { total: 2 } },
    });

    expect(await latestVersionedOntologyRelease('owner', signal)).toEqual(
      versioned
    );
    expect(get).toHaveBeenLastCalledWith('/ontologies/owner/releases', {
      params: { limit: 100, after: '12' },
      signal,
    });
  });

  it('uses the unversioned base only after exhausting the history', async () => {
    get.mockResolvedValue({ data: { data: [], paging: { total: 0 } } });

    expect(await latestVersionedOntologyRelease('owner', signal)).toBeNull();
  });

  it('refuses a guessed version when legacy history exceeds the bounded lookup', async () => {
    let revision = 2000;
    get.mockImplementation(async () => ({
      data: { data: [], paging: { after: String(revision--), total: 2000 } },
    }));

    await expect(
      latestVersionedOntologyRelease('owner', signal)
    ).rejects.toThrow('bounded history lookup');
    expect(get).toHaveBeenCalledTimes(10);
  });

  it('rejects releases belonging to another owner', async () => {
    get.mockResolvedValue({
      data: {
        data: [{ ontology: { id: 'other' }, semanticVersion: '9.0.0' }],
        paging: { total: 1 },
      },
    });

    await expect(
      latestVersionedOntologyRelease('owner', signal)
    ).rejects.toThrow('owner does not match');
  });
});
