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
import { EntityType } from '../enums/entity.enum';
import { queryClient } from '../queryClient';
import { DOMAIN_STYLES_QUERY_KEY } from '../rest/queries/domainStyleQuery';
import { createEntityWithCoverImage } from './CoverImageUploadUtils';

jest.mock('@openmetadata/ui-core-components', () => ({
  toast: { success: jest.fn(), warning: jest.fn() },
}));

jest.mock('../rest/domainAPI', () => ({
  getDomainStyles: jest.fn(),
}));

const createWith = (entityType: EntityType) =>
  createEntityWithCoverImage({
    formData: { name: 'sales' },
    entityType,
    entityLabel: 'Domain',
    entityPluralLabel: 'domains',
    createEntity: jest.fn().mockResolvedValue({ id: 'id-1', name: 'sales' }),
    patchEntity: jest.fn(),
    onSuccess: jest.fn(),
    t: (key: string) => key,
  });

describe('createEntityWithCoverImage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Chips read one cached list of domain and data product styles; a styled
  // entity created in this tab has to be in it before its chips render.
  it.each([EntityType.DOMAIN, EntityType.DATA_PRODUCT])(
    'should invalidate the cached chip styles after creating a %s',
    async (entityType) => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      await createWith(entityType);

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: DOMAIN_STYLES_QUERY_KEY,
      });
    }
  );

  it('should leave the chip styles alone after creating another entity type', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await createWith(EntityType.GLOSSARY);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
