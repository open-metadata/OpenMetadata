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
import {
  AssetTypeConfiguration,
  SearchSettings,
} from '../generated/configuration/searchSettings';
import { getEffectiveRankingConfiguration } from './SearchSettingsUtils';

describe('SearchSettingsUtils', () => {
  it('Should handle runtime ranking stages without a name', () => {
    const searchConfig = {
      defaultConfiguration: {
        ranking: {
          stages: [
            {
              fields: ['description'],
            },
          ],
        },
      },
    } as unknown as SearchSettings;
    const assetConfig = {
      assetType: 'table',
      searchFields: [{ field: 'name', boost: 1 }],
    } as AssetTypeConfiguration;

    const ranking = getEffectiveRankingConfiguration(searchConfig, assetConfig);

    expect(ranking?.stages?.[0].fields).toEqual(['description']);
  });
});
