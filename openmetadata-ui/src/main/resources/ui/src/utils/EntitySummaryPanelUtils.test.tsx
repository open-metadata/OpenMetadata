/*
 *  Copyright 2023 Collate.
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

import { SummaryEntityType } from '../enums/EntitySummary.enum';
import { Column } from '../generated/entity/data/table';
import {
  getFormattedEntityData,
  getSortedTagsWithHighlight,
  getSummaryListItemType,
  getTitle,
} from './EntitySummaryPanelUtils';
import {
  mockEntityDataWithNesting,
  mockEntityDataWithNestingResponse,
  mockEntityDataWithoutNesting,
  mockEntityDataWithoutNestingResponse,
  mockGetSummaryListItemTypeResponse,
  mockInvalidDataResponse,
  mockLinkBasedSummaryTitleResponse,
  mockListItemForLinkBasedTitle,
  mockListItemForTextBasedTitle,
  mockTagFQNsForHighlight,
  mockTagsDataAfterSortAndHighlight,
  mockTagsDataBeforeSortAndHighlight,
  mockTextBasedSummaryTitleResponse,
} from './mocks/EntitySummaryPanelUtils.mock';

describe('EntitySummaryPanelUtils tests', () => {
  it('getFormattedEntityData should return formatted data properly for table columns data without nesting, and also sort the data based on given arr', () => {
    const highlights = {
      'tag.name': ['PersonalData.SpecialCategory'],
    };
    const resultFormattedData = getFormattedEntityData(
      SummaryEntityType.COLUMN,
      mockEntityDataWithoutNesting,
      highlights
    );

    expect(resultFormattedData).toEqual(mockEntityDataWithoutNestingResponse);
  });

  it('getFormattedEntityData should return formatted data properly for topic fields data with nesting', () => {
    const resultFormattedData = getFormattedEntityData(
      SummaryEntityType.COLUMN,
      mockEntityDataWithNesting
    );

    expect(resultFormattedData).toEqual(mockEntityDataWithNestingResponse);
  });

  it('getFormattedEntityData should return empty array in case entityType is given other than from type SummaryEntityType', () => {
    const resultFormattedData = getFormattedEntityData(
      'otherType' as SummaryEntityType,
      mockEntityDataWithNesting
    );

    expect(resultFormattedData).toEqual([]);
  });

  it('getFormattedEntityData should not throw error if entityDetails sent does not have fields present', () => {
    const resultFormattedData = getFormattedEntityData(
      SummaryEntityType.COLUMN,
      [{}] as Column[]
    );

    expect(resultFormattedData).toEqual(mockInvalidDataResponse);
  });

  it('getSortedTagsWithHighlight should return the sorted and highlighted tags data based on given tagFQN array', () => {
    const sortedTags = getSortedTagsWithHighlight({
      sortTagsBasedOnGivenTagFQNs: mockTagFQNsForHighlight,
      tags: mockTagsDataBeforeSortAndHighlight,
    });

    expect(sortedTags).toEqual(mockTagsDataAfterSortAndHighlight);
  });

  it('getSummaryListItemType should return the summary item type based on given entityType', () => {
    const summaryItemType = getSummaryListItemType(
      SummaryEntityType.COLUMN,
      mockEntityDataWithoutNesting[0]
    );

    expect(summaryItemType).toEqual(mockGetSummaryListItemTypeResponse);
  });

  it('getTitle should return title as link or text based on sourceUrl present and also apply highlight is present', () => {
    const textBasedTitle = getTitle(
      mockListItemForTextBasedTitle,
      "<span className='text-highlight'>Title1</span>"
    );

    expect(textBasedTitle).toEqual(mockTextBasedSummaryTitleResponse);

    const linkBasedTitle = getTitle(mockListItemForLinkBasedTitle);

    expect(linkBasedTitle).toEqual(mockLinkBasedSummaryTitleResponse);
  });
});
