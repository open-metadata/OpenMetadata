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

const NAME_NGRAM = 'name.ngram';
const DISPLAYNAME_NGRAM = 'displayName.ngram';
const NAME_KEYWORD = 'name.keyword';

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

  it('Should derive partial name stages from configured ngram name fields', () => {
    const searchConfig = {
      defaultConfiguration: {
        ranking: {
          stages: [
            {
              name: 'partialName',
              fields: [NAME_NGRAM],
            },
          ],
        },
      },
    } as SearchSettings;
    const assetConfig = {
      assetType: 'table',
      searchFields: [
        { field: 'displayName', boost: 10 },
        { field: DISPLAYNAME_NGRAM, boost: 8 },
        { field: 'name', boost: 10 },
        { field: NAME_NGRAM, boost: 8 },
        { field: 'description', boost: 1 },
      ],
    } as AssetTypeConfiguration;

    const ranking = getEffectiveRankingConfiguration(searchConfig, assetConfig);

    expect(ranking?.stages?.[0].fields).toEqual([
      DISPLAYNAME_NGRAM,
      NAME_NGRAM,
    ]);
  });

  it('Should mirror backend stage derivation for default ranking stages', () => {
    const searchConfig = {
      defaultConfiguration: {
        ranking: {
          stages: [
            {
              name: 'exactName',
              fields: [NAME_KEYWORD],
            },
            {
              name: 'phraseName',
              fields: ['name'],
            },
            {
              name: 'closeName',
              fields: ['name'],
            },
            {
              name: 'fuzzyName',
              fields: ['name'],
            },
            {
              name: 'partialName',
              fields: [NAME_NGRAM],
            },
            {
              name: 'structuralContext',
              fields: ['fullyQualifiedName'],
            },
            {
              name: 'descriptionContext',
              fields: ['description'],
            },
          ],
        },
      },
    } as SearchSettings;
    const assetConfig = {
      assetType: 'table',
      searchFields: [
        { field: 'displayName', boost: 10 },
        { field: 'displayName.keyword', boost: 10 },
        { field: DISPLAYNAME_NGRAM, boost: 8 },
        { field: 'name', boost: 10 },
        { field: NAME_KEYWORD, boost: 10 },
        { field: NAME_NGRAM, boost: 8 },
        { field: 'fullyQualifiedName', boost: 5 },
        { field: 'columns.name', boost: 3 },
        { field: 'description', boost: 1 },
        { field: 'columns.description', boost: 1 },
        { field: 'extension.owner', boost: 1 },
      ],
    } as AssetTypeConfiguration;

    const ranking = getEffectiveRankingConfiguration(searchConfig, assetConfig);

    expect(ranking?.stages?.map((stage) => stage.fields)).toEqual([
      ['displayName.keyword', NAME_KEYWORD, 'fullyQualifiedName'],
      ['displayName', 'name', 'fullyQualifiedName'],
      ['displayName', 'name', 'fullyQualifiedName'],
      ['displayName', 'name', 'fullyQualifiedName'],
      [DISPLAYNAME_NGRAM, NAME_NGRAM],
      ['columns.name'],
      ['description', 'columns.description'],
    ]);
  });
});
