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
import { APIRequestContext } from '@playwright/test';

const SUGGESTION_DESCRIPTION_DATA = {
  description: 'this is suggested data description',
  type: 'SuggestDescription',
};

const SUGGESTION_TAGS_DATA = {
  tagLabels: [
    {
      displayName: 'Personal',
      labelType: 'Manual',
      name: 'Personal',
      source: 'Classification',
      state: 'Suggested',
      tagFQN: 'PersonalData.Personal',
    },
  ],
  type: 'SuggestTagLabel',
};

const SUGGESTION_TIER_TAGS_DATA = {
  tagLabels: [
    {
      displayName: 'Tier1',
      labelType: 'Manual',
      name: 'Tier1',
      source: 'Classification',
      state: 'Suggested',
      tagFQN: 'Tier.Tier1',
    },
  ],
  type: 'SuggestTagLabel',
};

export const createTableDescriptionSuggestions = async (
  apiContext: APIRequestContext,
  entityLink: string
) => {
  const suggestionResponse = await apiContext.post('/api/v1/suggestions', {
    data: {
      ...SUGGESTION_DESCRIPTION_DATA,
      entityLink,
    },
  });

  return suggestionResponse;
};

export const createTableTagsSuggestions = async (
  apiContext: APIRequestContext,
  entityLink: string,
  isTierTag?: boolean
) => {
  const suggestionResponse = await apiContext.post('/api/v1/suggestions', {
    data: {
      ...(isTierTag ? SUGGESTION_TIER_TAGS_DATA : SUGGESTION_TAGS_DATA),
      entityLink,
    },
  });

  return suggestionResponse;
};
