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
import { getSuggestionByType } from './SuggestionUtils';

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
