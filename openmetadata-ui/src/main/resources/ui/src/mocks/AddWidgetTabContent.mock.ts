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

import { Document } from '../generated/entity/docStore/document';

export const mockWidget: Document = {
  id: '5bf549a2-adc7-48be-8a61-17c08aeeaa1b',
  name: 'Following',
  displayName: 'Following',
  fullyQualifiedName: 'KnowledgePanel.Following',
  description:
    'Lists data assets that the user is actively following and provides quick access.',
  entityType: 'KnowledgePanel',
  data: {
    gridSizes: ['small'],
  },
  updatedBy: 'admin',
};

export const mockWidgetSizes = [
  { label: 'Small', value: 1 },
  { label: 'Medium', value: 2 },
];
