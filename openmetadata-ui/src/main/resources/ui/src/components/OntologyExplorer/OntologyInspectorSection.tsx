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
import { Button } from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';

interface InspectorSectionHeadingProps {
  readonly count: number;
  readonly label: string;
}

export const InspectorSectionHeading = ({
  count,
  label,
}: InspectorSectionHeadingProps) => (
  <div className="tw:mb-2.5 tw:flex tw:items-center tw:gap-2">
    <h3 className="tw:m-0 tw:font-body tw:text-[13px] tw:leading-normal tw:font-semibold tw:text-primary">
      {label}
    </h3>
    <span className="tw:rounded-full tw:border tw:border-secondary tw:bg-tertiary tw:px-2 tw:py-px tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-secondary">
      {count}
    </span>
  </div>
);

interface InspectorAddButtonProps {
  readonly isDisabled: boolean;
  readonly isPrimary?: boolean;
  readonly label: string;
  readonly testId: string;
  readonly onClick: () => void;
}

export const InspectorAddButton = ({
  isDisabled,
  isPrimary = false,
  label,
  testId,
  onClick,
}: InspectorAddButtonProps) => (
  <Button
    noTextPadding
    className={classNames(
      'tw:mt-2 tw:flex tw:w-full tw:items-center tw:justify-center tw:gap-1 tw:rounded-[9px] tw:border tw:border-dashed tw:bg-primary tw:px-2.5 tw:py-[9px] tw:*:data-icon:size-3',
      'tw:font-body tw:text-xs tw:leading-normal tw:font-semibold',
      isPrimary
        ? 'tw:border-brand tw:text-brand-tertiary'
        : 'tw:border-primary tw:text-secondary',
      isDisabled && 'tw:cursor-not-allowed tw:opacity-50'
    )}
    color="tertiary"
    data-testid={testId}
    iconLeading={Plus}
    isDisabled={isDisabled}
    onClick={onClick}>
    {label}
  </Button>
);
