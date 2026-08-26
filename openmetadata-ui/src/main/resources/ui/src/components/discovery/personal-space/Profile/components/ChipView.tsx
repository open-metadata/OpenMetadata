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
  Tag,
  TagGroup,
  TagList,
  Typography,
} from '@openmetadata/ui-core-components';
import { EntityReference } from '../../../../../generated/entity/type';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import React from 'react';

interface ChipViewProps {
  values: EntityReference[];
  noDataPlaceholder?: string;
  /** Accessible label for the tag group (the field name). */
  label?: string;
}

/**
 * The right-column value of a field row: a right-aligned wrapping list of entity
 * chips, or a placeholder when empty. The field label lives on the parent
 * `FieldRow` / `InlineEditCard`, not here.
 */
const ChipView: React.FC<ChipViewProps> = ({
  values,
  noDataPlaceholder,
  label,
}) =>
  values.length === 0 ? (
    <Typography className="tw:text-secondary" size="text-sm">
      {noDataPlaceholder ?? '--'}
    </Typography>
  ) : (
    <TagGroup label={label ?? ''}>
      <TagList className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
        {values.map((value) => (
          <Tag id={value.id} key={value.id}>
            {getEntityName(value)}
          </Tag>
        ))}
      </TagList>
    </TagGroup>
  );

export default ChipView;
