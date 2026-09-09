/*
 *  Copyright 2026 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import type { FieldProps } from '@react-awesome-query-builder/ui';
import { FC } from 'react';
import type { QueryBuilderControlProps } from './QueryBuilderCanvas.types';

/**
 * A labelled field or operator control.
 *
 * The control itself is whatever the config registers as `renderField` /
 * `renderOperator` — the same component RAQB would have called. Those carry
 * behaviour that is easy to lose and hard to rediscover (a stable item
 * identity across RAQB's re-created `items`, a controlled `inputValue` so a
 * re-render cannot wipe the user's filter text, `allowsEmptyCollection` so the
 * popup does not dead-end), plus the testids Playwright locates. Only the
 * label and the column around it belong to the canvas.
 */
const QueryBuilderControl: FC<QueryBuilderControlProps> = ({
  label,
  items,
  selectedKey,
  placeholder,
  readonly,
  render,
  dataTestId,
  onChange,
}) => (
  <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5">
    <Typography
      as="span"
      className="tw:font-medium tw:text-secondary"
      size="text-sm">
      {label}
    </Typography>
    {render?.({
      // Only when set: the renderer supplies its own default, and an explicit
      // `undefined` would win over it through the spread.
      ...(dataTestId ? { dataTestId } : {}),
      items,
      placeholder,
      readonly,
      selectedKey: selectedKey ?? undefined,
      setField: onChange,
    } as unknown as FieldProps)}
  </div>
);

export default QueryBuilderControl;
