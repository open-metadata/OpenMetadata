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
import { highlightEntityNameAndDescription } from './EntityUtils';
import {
  entityWithoutNameAndDescHighlight,
  highlightedEntityDescription,
  highlightedEntityDisplayName,
  mockHighlights,
} from './mocks/EntityUtils.mock';

describe('EntityUtils unit tests', () => {
  it('highlightEntityNameAndDescription method should return the entity with highlighted name and description', () => {
    const highlightedEntity = highlightEntityNameAndDescription(
      entityWithoutNameAndDescHighlight,
      mockHighlights
    );

    expect(highlightedEntity.displayName).toBe(highlightedEntityDisplayName);
    expect(highlightedEntity.description).toBe(highlightedEntityDescription);
  });
});
