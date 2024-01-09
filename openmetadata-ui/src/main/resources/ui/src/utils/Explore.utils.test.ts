/*
 *  Copyright 2024 Collate.
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
import { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import {
  getQuickFilterQuery,
  getSearchIndexFromEntityType,
} from './Explore.utils';

describe('Explore Utils', () => {
  it('should return undefined if data is empty', () => {
    const data: ExploreQuickFilterField[] = [];
    const result = getQuickFilterQuery(data);

    expect(result).toBeUndefined();
  });

  it('should generate quick filter query correctly', () => {
    const data = [
      {
        label: 'Domain',
        key: 'domain.displayName.keyword',
        value: [],
      },
      {
        label: 'Owner',
        key: 'owner.displayName.keyword',
        value: [],
      },
      {
        label: 'Tag',
        key: 'tags.tagFQN',
        value: [
          {
            key: 'personaldata.personal',
            label: 'personaldata.personal',
            count: 1,
          },
        ],
      },
    ];
    const result = getQuickFilterQuery(data);
    const expectedQuery = {
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    term: {
                      'tags.tagFQN': 'personaldata.personal',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    expect(result).toEqual(expectedQuery);
  });

  it('getSearchIndexFromEntityType should return the correct search index for each entity type', () => {
    expect(getSearchIndexFromEntityType(EntityType.ALL)).toEqual(
      SearchIndex.ALL
    );
    expect(getSearchIndexFromEntityType(EntityType.TABLE)).toEqual(
      SearchIndex.TABLE
    );
    expect(getSearchIndexFromEntityType(EntityType.PIPELINE)).toEqual(
      SearchIndex.PIPELINE
    );
    expect(getSearchIndexFromEntityType(EntityType.DASHBOARD)).toEqual(
      SearchIndex.DASHBOARD
    );
    expect(getSearchIndexFromEntityType(EntityType.MLMODEL)).toEqual(
      SearchIndex.MLMODEL
    );
    expect(getSearchIndexFromEntityType(EntityType.TOPIC)).toEqual(
      SearchIndex.TOPIC
    );
    expect(getSearchIndexFromEntityType(EntityType.CONTAINER)).toEqual(
      SearchIndex.CONTAINER
    );
    expect(getSearchIndexFromEntityType(EntityType.TAG)).toEqual(
      SearchIndex.TAG
    );
    expect(getSearchIndexFromEntityType(EntityType.GLOSSARY_TERM)).toEqual(
      SearchIndex.GLOSSARY
    );
    expect(getSearchIndexFromEntityType(EntityType.STORED_PROCEDURE)).toEqual(
      SearchIndex.STORED_PROCEDURE
    );
    expect(
      getSearchIndexFromEntityType(EntityType.DASHBOARD_DATA_MODEL)
    ).toEqual(SearchIndex.DASHBOARD_DATA_MODEL);
    expect(getSearchIndexFromEntityType(EntityType.SEARCH_INDEX)).toEqual(
      SearchIndex.SEARCH_INDEX
    );
    expect(getSearchIndexFromEntityType(EntityType.DATABASE_SERVICE)).toEqual(
      SearchIndex.DATABASE_SERVICE
    );
    expect(getSearchIndexFromEntityType(EntityType.MESSAGING_SERVICE)).toEqual(
      SearchIndex.MESSAGING_SERVICE
    );
    expect(getSearchIndexFromEntityType(EntityType.DASHBOARD_SERVICE)).toEqual(
      SearchIndex.DASHBOARD_SERVICE
    );
    expect(getSearchIndexFromEntityType(EntityType.PIPELINE_SERVICE)).toEqual(
      SearchIndex.PIPELINE_SERVICE
    );
    expect(getSearchIndexFromEntityType(EntityType.MLMODEL_SERVICE)).toEqual(
      SearchIndex.ML_MODEL_SERVICE
    );
    expect(getSearchIndexFromEntityType(EntityType.STORAGE_SERVICE)).toEqual(
      SearchIndex.STORAGE_SERVICE
    );
    expect(getSearchIndexFromEntityType(EntityType.SEARCH_SERVICE)).toEqual(
      SearchIndex.SEARCH_SERVICE
    );
    expect(getSearchIndexFromEntityType(EntityType.DOMAIN)).toEqual(
      SearchIndex.DOMAIN
    );
    expect(getSearchIndexFromEntityType(EntityType.DATA_PRODUCT)).toEqual(
      SearchIndex.DATA_PRODUCT
    );
  });
});
