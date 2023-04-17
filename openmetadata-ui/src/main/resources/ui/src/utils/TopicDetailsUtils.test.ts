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

import {
  mockSortedTopicDetails,
  mockTopicDetails,
} from './mocks/TopicDetailsUtils.mock';
import { getFormattedTopicDetails } from './TopicDetailsUtils';

describe('TopicDetailsUtils test', () => {
  it('getFormattedTopicDetails should return topic details with sorted tags for schema fields', () => {
    const results = getFormattedTopicDetails(mockTopicDetails);

    expect(results).toEqual(mockSortedTopicDetails);
  });

  it('getFormattedTopicDetails should return expected results in case no messageSchema present', () => {
    const modifiedTopicDetails = {
      ...mockTopicDetails,
      messageSchema: undefined,
    };

    const results = getFormattedTopicDetails(modifiedTopicDetails);

    expect(results).toEqual({ ...modifiedTopicDetails, tags: [] });
  });

  it('getFormattedTopicDetails should return expected results in case no schemaFields present', () => {
    const modifiedTopicDetails = {
      ...mockTopicDetails,
      messageSchema: {
        ...mockTopicDetails.messageSchema,
        schemaFields: undefined,
      },
    };

    const results = getFormattedTopicDetails(modifiedTopicDetails);

    expect(results).toEqual({ ...modifiedTopicDetails, tags: [] });
  });

  it('getFormattedTopicDetails should return expected results in case schemaFields is an empty array', () => {
    const modifiedTopicDetails = {
      ...mockTopicDetails,
      messageSchema: {
        ...mockTopicDetails.messageSchema,
        schemaFields: [],
      },
    };

    const results = getFormattedTopicDetails(modifiedTopicDetails);

    expect(results).toEqual({ ...modifiedTopicDetails, tags: [] });
  });
});
