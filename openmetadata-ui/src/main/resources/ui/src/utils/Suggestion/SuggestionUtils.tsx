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
import { SuggestionDataByTypes } from '../../components/Suggestions/SuggestionsProvider/SuggestionsProvider.interface';
import {
  Suggestion,
  SuggestionType,
} from '../../generated/entity/feed/suggestion';
import { EntityReference } from '../../generated/type/entityReference';

export const getSuggestionByType = (suggestion: Suggestion[]) => {
  return suggestion.reduce(
    (acc, cv: Suggestion) => {
      const createdBy = cv.createdBy as EntityReference;
      acc.allUsersList.push(createdBy);

      // Group suggestions by createdBy name
      const createdByName = createdBy?.name ?? '';
      if (!acc.groupedSuggestions.has(createdByName)) {
        acc.groupedSuggestions.set(createdByName, {
          tags: [],
          description: [],
          combinedData: [],
        });
      }

      acc.groupedSuggestions.get(createdByName)?.combinedData.push(cv);
      if (cv.type === SuggestionType.SuggestTagLabel) {
        acc.groupedSuggestions.get(createdByName)?.tags.push(cv);
      } else {
        acc.groupedSuggestions.get(createdByName)?.description.push(cv);
      }

      return acc;
    },
    {
      allUsersList: [] as EntityReference[],
      groupedSuggestions: new Map<string, SuggestionDataByTypes>(),
    }
  );
};

// Helper function to get unique suggestions
export const getUniqueSuggestions = (
  existingSuggestions: Suggestion[],
  newSuggestions: Suggestion[]
) => {
  if (newSuggestions.length === 0) {
    return existingSuggestions;
  }
  const existingMap = new Map(existingSuggestions.map((s) => [s.id, s]));

  // Filter out duplicates and merge
  const uniqueNewSuggestions = newSuggestions.filter(
    (s) => !existingMap.has(s.id)
  );

  return [...existingSuggestions, ...uniqueNewSuggestions];
};
