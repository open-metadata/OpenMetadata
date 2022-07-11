/*
 *  Copyright 2021 Collate
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

import React, { FC } from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';
import TagSuggestion from './TagSuggestion';

interface TagsTaskProps {
  suggestions: TagLabel[];
  setSuggestion: (value: TagLabel[]) => void;
}

const TagsTask: FC<TagsTaskProps> = ({ suggestions, setSuggestion }) => {
  return (
    <div data-testid="task-tags-tabs">
      <p className="tw-text-grey-muted">Tags:</p>{' '}
      <TagSuggestion selectedTags={suggestions} onChange={setSuggestion} />
    </div>
  );
};

export default TagsTask;
