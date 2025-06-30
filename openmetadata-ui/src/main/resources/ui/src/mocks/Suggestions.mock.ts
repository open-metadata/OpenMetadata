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
} from '../generated/entity/feed/suggestion';
import { EntityReference } from '../generated/type/entityReference';

export const MOCK_SUGGESTIONS = [
  {
    id: '1',
    description: 'Test suggestion1',
    type: SuggestionType.SuggestDescription,
    createdBy: { id: '1', name: 'Avatar 1', type: 'user' },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  },
  {
    id: '2',
    description: 'Test suggestion2',
    type: SuggestionType.SuggestTagLabel,
    createdBy: { id: '2', name: 'Avatar 2', type: 'user' },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  },
  {
    id: '3',
    description: 'Test suggestion3',
    type: SuggestionType.SuggestDescription,
    createdBy: { id: '1', name: 'Avatar 1', type: 'user' },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  },
];

export const mockSuggestion1: Suggestion = {
  id: '1',
  type: SuggestionType.SuggestDescription,
  createdBy: { id: '1', name: 'John Doe' } as EntityReference,
  description: 'Suggestion 1',
} as Suggestion;

export const mockSuggestion2: Suggestion = {
  id: '2',
  type: SuggestionType.SuggestTagLabel,
  createdBy: { id: '2', name: 'Jane Smith' } as EntityReference,
  description: 'Suggestion 2',
} as Suggestion;

export const mockSuggestion3: Suggestion = {
  id: '3',
  type: SuggestionType.SuggestDescription,
  createdBy: { id: '3', name: 'Bob Johnson' } as EntityReference,
  description: 'Suggestion 3',
} as Suggestion;
