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
  tagLabels: [
    {
      description:
        'Data that can be used to directly or indirectly identify a person.',
      displayName: 'Personal15',
      href: 'http://localhost:8585/api/v1/tags/d90759e3-f94e-4e17-8624-9cbe31d347b7',
      labelType: 'Manual',
      name: 'Personal',
      source: 'Classification',
      state: 'Suggested',
      style: {
        color: 'string',
        iconURL: 'string',
      },
      tagFQN: 'PersonalData.Personal15',
    },
  ],
  type: 'SuggestDescription',
};

export const createTableSuggestions = async (
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
