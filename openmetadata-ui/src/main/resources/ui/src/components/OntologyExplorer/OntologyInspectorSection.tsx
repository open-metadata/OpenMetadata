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
import { Badge, Button, Typography } from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { ReactNode } from 'react';

interface InspectorSectionHeadingProps {
  readonly count: number;
  readonly label: string;
}

export const InspectorSectionHeading = ({
  count,
  label,
}: InspectorSectionHeadingProps) => (
  <div className="tw:mb-3 tw:flex tw:items-center tw:gap-2">
    <h3 className="tw:m-0 tw:text-md tw:font-semibold tw:text-primary">
      {label}
    </h3>
    <Badge color="gray" size="sm" type="pill-color">
      {count}
    </Badge>
  </div>
);

export const InspectorEmptyText = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <Typography as="p" className="tw:m-0" color="secondary" size="text-sm">
    {children}
  </Typography>
);

export const InspectorList = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <div className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary">
    {children}
  </div>
);

interface InspectorRowProps {
  readonly children: ReactNode;
  readonly testId?: string;
}

export const InspectorRow = ({ children, testId }: InspectorRowProps) => (
  <div
    className="tw:flex tw:min-h-12 tw:items-center tw:gap-3 tw:px-3 tw:py-2"
    data-testid={testId}>
    {children}
  </div>
);

interface InspectorAddButtonProps {
  readonly isDisabled: boolean;
  readonly label: string;
  readonly testId: string;
  readonly onClick: () => void;
}

export const InspectorAddButton = ({
  isDisabled,
  label,
  testId,
  onClick,
}: InspectorAddButtonProps) => (
  <Button
    className="tw:mt-3 tw:w-full tw:after:outline-dashed"
    color="secondary"
    data-testid={testId}
    iconLeading={Plus}
    isDisabled={isDisabled}
    size="sm"
    onPress={onClick}>
    {label}
  </Button>
);
