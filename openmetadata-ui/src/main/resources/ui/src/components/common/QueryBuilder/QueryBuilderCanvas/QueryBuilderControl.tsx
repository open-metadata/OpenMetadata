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
import classNames from 'classnames';
import { FC, PropsWithChildren } from 'react';
import type { QueryBuilderControlProps } from './QueryBuilderCanvas.types';

// A labelled column of the rule grid.
export const QueryBuilderCell: FC<
  PropsWithChildren<{ label: string; className?: string }>
> = ({ label, className, children }) => (
  <div
    className={classNames(
      'tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5',
      className
    )}>
    <Typography
      as="span"
      className="tw:font-medium tw:text-secondary"
      size="text-sm">
      {label}
    </Typography>
    {children}
  </div>
);

// A labelled field or operator control.
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
  <QueryBuilderCell label={label}>
    {render?.({
      // Only when set: the renderer supplies its own default, and an explicit `undefined` would win over it through the
      // spread.
      ...(dataTestId ? { dataTestId } : {}),
      items,
      placeholder,
      readonly,
      selectedKey: selectedKey ?? undefined,
      setField: onChange,
    } as unknown as FieldProps)}
  </QueryBuilderCell>
);

export default QueryBuilderControl;
