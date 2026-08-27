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

import APIClient from '.';
import {
  GlossaryTermRelationType,
  RelationCategory,
} from '../generated/configuration/glossaryTermRelationSettings';
import {
  createGlossaryTermRelationType,
  deleteGlossaryTermRelationType,
  getGlossaryTermRelationTypes,
  updateGlossaryTermRelationType,
} from './glossaryAPI';

jest.mock('.');

const relationType: GlossaryTermRelationType = {
  name: 'dependsOn',
  displayName: 'Depends On',
  category: RelationCategory.Associative,
};

describe('glossary relation types API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists a page of relation types', async () => {
    const response = {
      data: {
        data: [relationType],
        paging: { limit: 15, offset: 15, total: 40 },
      },
    };
    (APIClient.get as jest.Mock).mockResolvedValueOnce(response);

    await expect(
      getGlossaryTermRelationTypes({ limit: 15, offset: 15 })
    ).resolves.toEqual(response.data);
    expect(APIClient.get).toHaveBeenCalledWith(
      '/system/settings/glossaryTermRelationSettings/relationTypes',
      { params: { limit: 15, offset: 15 } }
    );
  });

  it('creates, updates, and deletes one relation type at a time', async () => {
    (APIClient.post as jest.Mock).mockResolvedValueOnce({
      data: relationType,
    });
    (APIClient.put as jest.Mock).mockResolvedValueOnce({
      data: relationType,
    });
    (APIClient.delete as jest.Mock).mockResolvedValueOnce({});

    await expect(createGlossaryTermRelationType(relationType)).resolves.toEqual(
      relationType
    );
    await expect(updateGlossaryTermRelationType(relationType)).resolves.toEqual(
      relationType
    );

    await deleteGlossaryTermRelationType(relationType.name);

    const relationTypeUrl =
      '/system/settings/glossaryTermRelationSettings/relationTypes';

    expect(APIClient.post).toHaveBeenCalledWith(relationTypeUrl, relationType);
    expect(APIClient.put).toHaveBeenCalledWith(
      `${relationTypeUrl}/${relationType.name}`,
      relationType
    );
    expect(APIClient.delete).toHaveBeenCalledWith(
      `${relationTypeUrl}/${relationType.name}`
    );
  });
});
