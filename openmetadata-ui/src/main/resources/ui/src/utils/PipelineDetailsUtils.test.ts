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
  mockPipelineDetails,
  mockPipelineDetailsWithoutTaskTags,
  mockSortedPipelineDetails,
} from './mocks/PipelineDetailsUtils.mock';
import { getFormattedPipelineDetails } from './PipelineDetailsUtils';

describe('PipelineDetailsUtils test', () => {
  it('getFormattedPipelineDetails should return pipeline details with sorted tags for tasks', () => {
    const results = getFormattedPipelineDetails(mockPipelineDetails);

    expect(results).toEqual(mockSortedPipelineDetails);
  });

  it('getFormattedPipelineDetails should return pipeline details without any changes in case no tasks are present in it', () => {
    const modifiedPipelineDetails = {
      ...mockPipelineDetails,
      tasks: undefined,
    };

    const results = getFormattedPipelineDetails(modifiedPipelineDetails);

    expect(results).toEqual(modifiedPipelineDetails);
  });

  it('getFormattedPipelineDetails should return pipeline details without any changes in case no tags are present for the tasks', () => {
    const results = getFormattedPipelineDetails(
      mockPipelineDetailsWithoutTaskTags
    );

    expect(results).toEqual(mockPipelineDetailsWithoutTaskTags);
  });

  it('getFormattedPipelineDetails should return pipeline details without any changes if empty array is present for tasks field', () => {
    const results = getFormattedPipelineDetails({
      ...mockPipelineDetails,
      tasks: [],
    });

    expect(results).toEqual({
      ...mockPipelineDetails,
      tasks: [],
    });
  });
});
