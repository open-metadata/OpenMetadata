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
  getHighlightOfListItem,
  getMapOfListHighlights,
  getSortedTagsWithHighlight,
  getSummaryListItemType,
  getTitle,
} from './EntitySummaryPanelUtils';
import {
  mockEntityDataWithNesting,
  mockEntityDataWithNestingResponse,
  mockEntityDataWithoutNesting,
  mockEntityDataWithoutNestingResponse,
  mockGetHighlightOfListItemResponse,
  mockGetMapOfListHighlightsResponse,
  mockGetSummaryListItemTypeResponse,
  mockHighlights,
  mockInvalidDataResponse,
  mockLinkBasedSummaryTitleResponse,
  mockListItemNameHighlight,
  mockTagFQNsForHighlight,
  mockTagsSortAndHighlightResponse,
  mockTextBasedSummaryTitleResponse,
} from './mocks/EntitySummaryPanelUtils.mock';

jest.mock('../constants/EntitySummaryPanelUtils.constant', () => ({
  ...jest.requireActual('../constants/EntitySummaryPanelUtils.constant'),
  SummaryListHighlightKeys: [
    'columns.name',
    'columns.description',
    'columns.children.name',
  ],
}));

describe('EntitySummaryPanelUtils tests', () => {
  describe('getFormattedEntityData', () => {
    it('getFormattedEntityData should return formatted data properly for table columns data with nesting, and also sort the data based on highlights', () => {
      const resultFormattedData = getFormattedEntityData(
        SummaryEntityType.COLUMN,
        mockEntityDataWithNesting,
        mockHighlights
      );

      expect(resultFormattedData).toEqual(mockEntityDataWithNestingResponse);
    });

    it('getFormattedEntityData should return formatted data properly for pipeline data without nesting', () => {
      const resultFormattedData = getFormattedEntityData(
        SummaryEntityType.TASK,
        mockEntityDataWithoutNesting
      );

      expect(resultFormattedData).toEqual(mockEntityDataWithoutNestingResponse);
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
  });

  describe('getSortedTagsWithHighlight', () => {
    it('getSortedTagsWithHighlight should return the sorted and highlighted tags data based on given tagFQN array', () => {
      const sortedTags = getSortedTagsWithHighlight({
        sortTagsBasedOnGivenTagFQNs: mockTagFQNsForHighlight,
        tags: mockEntityDataWithNesting[2].tags,
      });

      expect(sortedTags).toEqual(mockTagsSortAndHighlightResponse);
    });
  });

  describe('getSummaryListItemType', () => {
    it('getSummaryListItemType should return the summary item type based on given entityType', () => {
      const summaryItemType = getSummaryListItemType(
        SummaryEntityType.TASK,
        mockEntityDataWithoutNesting[0]
      );

      expect(summaryItemType).toEqual(mockGetSummaryListItemTypeResponse);
    });
  });

  describe('getTitle', () => {
    it('getTitle should return title as text if sourceUrl not present in listItem and also apply highlight if present', () => {
      const textBasedTitle = getTitle(
        mockEntityDataWithNesting[0],
        mockListItemNameHighlight
      );

      expect(textBasedTitle).toEqual(mockTextBasedSummaryTitleResponse);
    });

    it('getTitle should return title as link if sourceUrl present in listItem', () => {
      const linkBasedTitle = getTitle(mockEntityDataWithoutNesting[0]);

      expect(linkBasedTitle).toEqual(mockLinkBasedSummaryTitleResponse);
    });
  });

  describe('getMapOfListHighlights', () => {
    it('getMapOfListHighlights should returns empty arrays and map when highlights is undefined', () => {
      const result = getMapOfListHighlights();

      expect(result.listHighlights).toEqual([]);
      expect(result.listHighlightsMap).toEqual({});
    });

    it('getMapOfListHighlights should returns listHighlights and listHighlightsMap correctly', () => {
      const result = getMapOfListHighlights(mockHighlights);

      expect(result).toEqual(mockGetMapOfListHighlightsResponse);
    });
  });

  describe('getHighlightOfListItem', () => {
    it('getHighlightOfListItem should return highlights of listItem undefined, if listHighlights and tagHighlights not passed in params', () => {
      const result = getHighlightOfListItem(
        mockEntityDataWithNesting[0],
        [] as string[],
        [] as string[],
        {} as { [key: string]: number }
      );

      expect(result).toEqual({
        highlightedTags: undefined,
        highlightedTitle: undefined,
        highlightedDescription: undefined,
      });
    });

    it('getHighlightOfListItem should return highlights of listItem if listHighlights and tagHighlights get in params', () => {
      const result = getHighlightOfListItem(
        mockEntityDataWithNesting[1],
        mockTagFQNsForHighlight,
        mockGetMapOfListHighlightsResponse.listHighlights,
        mockGetMapOfListHighlightsResponse.listHighlightsMap
      );

      expect(result).toEqual(mockGetHighlightOfListItemResponse);
    });
  });
});
