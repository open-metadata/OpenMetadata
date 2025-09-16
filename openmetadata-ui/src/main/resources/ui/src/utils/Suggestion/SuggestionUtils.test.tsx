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
  Suggestion,
  SuggestionType,
} from '../../generated/entity/feed/suggestion';
import { EntityReference } from '../../generated/type/entityReference';
import {
  mockSuggestion1,
  mockSuggestion2,
  mockSuggestion3,
} from '../../mocks/Suggestions.mock';
import { getSuggestionByType, getUniqueSuggestions } from './SuggestionUtils';

describe('getSuggestionByType', () => {
  it('should correctly group suggestions by createdBy name and type', () => {
    const suggestionMock: Suggestion[] = [
      {
        type: SuggestionType.SuggestTagLabel,
        createdBy: { id: '1', name: 'John Doe' } as EntityReference,
      } as Suggestion,
      {
        type: SuggestionType.SuggestDescription,
        createdBy: { id: '2', name: 'Jane Smith' } as EntityReference,
      } as Suggestion,
      {
        type: SuggestionType.SuggestTagLabel,
        createdBy: { id: '1', name: 'John Doe' } as EntityReference,
      } as Suggestion,
      {
        type: SuggestionType.SuggestDescription,
        createdBy: { id: '1', name: 'John Doe' } as EntityReference,
      } as Suggestion,
    ];

    const result = getSuggestionByType(suggestionMock);

    // Check if all users are in the allUsersList
    expect(result.allUsersList).toHaveLength(4);

    // Check if the suggestions are grouped correctly by createdBy name
    const johnGroup = result.groupedSuggestions.get('John Doe');
    const janeGroup = result.groupedSuggestions.get('Jane Smith');

    expect(johnGroup?.tags).toHaveLength(2); // John has 2 SuggestTagLabel
    expect(johnGroup?.description).toHaveLength(1); // John has 1 SuggestDescription
    expect(johnGroup?.combinedData).toHaveLength(3); // John has 3 suggestions in total
    expect(janeGroup?.tags).toHaveLength(0); // Jane has 0 SuggestTagLabel
    expect(janeGroup?.description).toHaveLength(1); // Jane has 1 SuggestDescription
    expect(janeGroup?.combinedData).toHaveLength(1); // Jane has 1 suggestion in total
  });
});

describe('getUniqueSuggestions', () => {
  it('should return existing suggestions when new suggestions array is empty', () => {
    const existingSuggestions = [mockSuggestion1, mockSuggestion2];
    const newSuggestions: Suggestion[] = [];

    const result = getUniqueSuggestions(existingSuggestions, newSuggestions);

    expect(result).toEqual(existingSuggestions);
    expect(result).toHaveLength(2);
  });

  it('should merge new suggestions with existing ones, removing duplicates', () => {
    const existingSuggestions = [mockSuggestion1, mockSuggestion2];
    const newSuggestions = [mockSuggestion2, mockSuggestion3]; // mockSuggestion2 is duplicate

    const result = getUniqueSuggestions(existingSuggestions, newSuggestions);

    expect(result).toHaveLength(3); // Should have 3 unique suggestions
    expect(result).toContainEqual(mockSuggestion1);
    expect(result).toContainEqual(mockSuggestion2);
    expect(result).toContainEqual(mockSuggestion3);

    // Verify order: existing suggestions first, then new unique ones
    expect(result[0]).toEqual(mockSuggestion1);
    expect(result[1]).toEqual(mockSuggestion2);
    expect(result[2]).toEqual(mockSuggestion3);
  });

  it('should add all new suggestions when no duplicates exist', () => {
    const existingSuggestions = [mockSuggestion1];
    const newSuggestions = [mockSuggestion2, mockSuggestion3];

    const result = getUniqueSuggestions(existingSuggestions, newSuggestions);

    expect(result).toHaveLength(3);
    expect(result).toEqual([mockSuggestion1, mockSuggestion2, mockSuggestion3]);
  });

  it('should handle empty existing suggestions array', () => {
    const existingSuggestions: Suggestion[] = [];
    const newSuggestions = [mockSuggestion1, mockSuggestion2];

    const result = getUniqueSuggestions(existingSuggestions, newSuggestions);

    expect(result).toHaveLength(2);
    expect(result).toEqual(newSuggestions);
  });

  it('should filter out all new suggestions if they are all duplicates', () => {
    const existingSuggestions = [
      mockSuggestion1,
      mockSuggestion2,
      mockSuggestion3,
    ];
    const newSuggestions = [mockSuggestion1, mockSuggestion2]; // All are duplicates

    const result = getUniqueSuggestions(existingSuggestions, newSuggestions);

    expect(result).toHaveLength(3); // Same as existing
    expect(result).toEqual(existingSuggestions);
  });

  it('should handle large arrays efficiently', () => {
    const existingSuggestions = Array.from({ length: 1000 }, (_, i) => ({
      ...mockSuggestion1,
      id: `existing-${i}`,
    }));

    const newSuggestions = [
      ...Array.from({ length: 500 }, (_, i) => ({
        ...mockSuggestion1,
        id: `existing-${i}`, // First 500 are duplicates
      })),
      ...Array.from({ length: 500 }, (_, i) => ({
        ...mockSuggestion1,
        id: `new-${i}`, // Last 500 are unique
      })),
    ];

    const startTime = performance.now();
    const result = getUniqueSuggestions(existingSuggestions, newSuggestions);
    const endTime = performance.now();

    expect(result).toHaveLength(1500); // 1000 existing + 500 new unique
    expect(endTime - startTime).toBeLessThan(100); // Should be fast (< 100ms)
  });
});
