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

import { Glossary } from '../../../../generated/entity/data/glossary';

export const mockGlossaryEntityDetails: Glossary = {
  id: 'glossary-id-123',
  name: 'BusinessGlossary',
  fullyQualifiedName: 'BusinessGlossary',
  displayName: 'Business Glossary',
  description: 'Test glossary for fallback testing',
  version: 0.1,
  updatedAt: 1672668265493,
  updatedBy: 'admin',
  href: 'http://openmetadata-server:8585/api/v1/glossaries/glossary-id-123',
  tags: [],
  owners: [
    {
      id: 'owner-id-1',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
    },
  ],
};
