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
import { EntityUtilClassBase } from './EntityUtilClassBase';

/**
 * EntityUtilClassBase.test.ts mocks the routing helpers, so it can only assert which helper was
 * called. These cases deliberately use the real helpers and assert the URL a user lands on — the
 * observable behaviour of an ingestion-pipeline entity link.
 */
describe('EntityUtilClassBase ingestion pipeline routes', () => {
  const entityUtil = new EntityUtilClassBase();
  const pipelineFqn = 'bigquery-beta.bigquery-beta-1.7047fd1d';

  const linkFor = (serviceCategory?: string, serviceFqn?: string) =>
    entityUtil.getEntityLink(
      EntityType.INGESTION_PIPELINE,
      pipelineFqn,
      undefined,
      undefined,
      undefined,
      undefined,
      serviceCategory,
      serviceFqn
    );

  it('returns the service agents tab URL', () => {
    expect(linkFor('databaseServices', 'bigquery-beta')).toBe(
      '/service/databaseServices/bigquery-beta/agents'
    );
  });

  it('returns the same URL for the singular service entity type', () => {
    expect(linkFor('databaseService', 'bigquery-beta')).toBe(
      '/service/databaseServices/bigquery-beta/agents'
    );
  });

  it('encodes a service FQN containing a space', () => {
    expect(linkFor('databaseServices', 'Collate analytics test')).toBe(
      '/service/databaseServices/Collate%20analytics%20test/agents'
    );
  });

  it.each(['Snowflake', 'constructor', 'vishnu-test'])(
    'never returns a service URL for the non-category %s',
    (serviceCategory) => {
      const link = linkFor(serviceCategory, 'bigquery-beta');

      expect(link).not.toContain('/service/');
      expect(link).toBe(`/table/${pipelineFqn}`);
    }
  );

  it('falls back to the table URL without service context', () => {
    expect(linkFor()).toBe(`/table/${pipelineFqn}`);
  });
});
