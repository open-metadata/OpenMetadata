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

import { render, screen } from '@testing-library/react';
import { isEmpty } from 'lodash';
import { BrowserRouter } from 'react-router-dom';
import { EntityType } from '../enums/entity.enum';
import { SummaryEntityType } from '../enums/EntitySummary.enum';
import { Column } from '../generated/entity/data/table';
import {
  getEntityChildDetails,
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
  mockEntityReferenceDashboardData,
  mockGetHighlightOfListItemResponse,
  mockGetMapOfListHighlightsResponse,
  mockGetSummaryListItemTypeResponse,
  mockHighlights,
  mockInvalidDataResponse,
  mockLinkBasedSummaryTitleDashboardResponse,
  mockLinkBasedSummaryTitleResponse,
  mockListItemNameHighlight,
  mockStoredProcedureWithCode,
  mockStoredProcedureWithEmptyCode,
  mockStoredProcedureWithoutCode,
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

jest.mock('../components/Database/SchemaEditor/SchemaEditor', () => {
  return jest
    .fn()
    .mockImplementation(({ value }) => (
      <div data-testid="schema-editor">
        {isEmpty(value) ? 'No code available' : value}
      </div>
    ));
});

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

    it('getFormattedEntityData should render nesting for schema fields', () => {
      const resultFormattedData = getFormattedEntityData(
        SummaryEntityType.SCHEMAFIELD,
        mockEntityDataWithNesting,
        mockHighlights
      );

      expect(resultFormattedData).toEqual(mockEntityDataWithNestingResponse);
    });
  });

  describe('getSortedTagsWithHighlight', () => {
    it('getSortedTagsWithHighlight should return the sorted and highlighted tags data based on given tagFQN array', () => {
      const sortedTags = getSortedTagsWithHighlight(
        mockEntityDataWithNesting[2].tags,
        mockTagFQNsForHighlight
      );

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

    it('getTitle should return title as link without icon if type: dashboard present in listItem', () => {
      const linkBasedTitle = getTitle(mockEntityReferenceDashboardData);

      expect(linkBasedTitle).toEqual(
        mockLinkBasedSummaryTitleDashboardResponse
      );
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

  describe('getEntityChildDetails', () => {
    const renderWithRouter = (component: JSX.Element) => {
      return render(<BrowserRouter>{component}</BrowserRouter>);
    };

    describe('STORED_PROCEDURE cases', () => {
      it('should render stored procedure with code correctly', () => {
        const result = getEntityChildDetails(
          EntityType.STORED_PROCEDURE,
          mockStoredProcedureWithCode
        );

        renderWithRouter(result as JSX.Element);

        expect(screen.getByText('label.code')).toBeInTheDocument();
        expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
        expect(screen.getByTestId('schema-editor')).toHaveTextContent(
          'CREATE PROCEDURE test_stored_procedure() BEGIN SELECT * FROM users; END'
        );
      });

      it('should render stored procedure without code correctly (null storedProcedureCode)', () => {
        const result = getEntityChildDetails(
          EntityType.STORED_PROCEDURE,
          mockStoredProcedureWithoutCode
        );

        renderWithRouter(result as JSX.Element);

        expect(screen.getByText('label.code')).toBeInTheDocument();
        expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
        expect(screen.getByTestId('schema-editor')).toHaveTextContent(
          'No code available'
        );
      });

      it('should render stored procedure with empty code correctly', () => {
        const result = getEntityChildDetails(
          EntityType.STORED_PROCEDURE,
          mockStoredProcedureWithEmptyCode
        );

        renderWithRouter(result as JSX.Element);

        expect(screen.getByText('label.code')).toBeInTheDocument();
        expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
        expect(screen.getByTestId('schema-editor')).toHaveTextContent(
          'No code available'
        );
      });

      it('should render stored procedure with undefined code field correctly', () => {
        const mockStoredProcedureWithUndefinedCode = {
          ...mockStoredProcedureWithCode,
          storedProcedureCode: {
            language: 'SQL',
            code: undefined,
          },
        };

        const result = getEntityChildDetails(
          EntityType.STORED_PROCEDURE,
          mockStoredProcedureWithUndefinedCode
        );

        renderWithRouter(result as JSX.Element);

        expect(screen.getByText('label.code')).toBeInTheDocument();
        expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
        expect(screen.getByTestId('schema-editor')).toHaveTextContent(
          'No code available'
        );
      });

      it('should render stored procedure heading and testId correctly', () => {
        const result = getEntityChildDetails(
          EntityType.STORED_PROCEDURE,
          mockStoredProcedureWithCode
        );

        renderWithRouter(result as JSX.Element);

        expect(screen.getByTestId('code-header')).toBeInTheDocument();
        expect(screen.getByTestId('code-header')).toHaveTextContent(
          'label.code'
        );
      });
    });
  });
});
