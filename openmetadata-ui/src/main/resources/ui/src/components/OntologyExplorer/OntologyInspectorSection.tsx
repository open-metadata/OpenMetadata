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
import {
  Badge,
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01, XClose } from '@openmetadata/ui-core-components/icons';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface InspectorSectionProps {
  readonly children: ReactNode;
  readonly testId?: string;
}

export const InspectorSection = ({
  children,
  testId,
}: InspectorSectionProps) => (
  <Box
    className="tw:rounded-xl tw:bg-secondary tw:px-4 tw:pt-3 tw:pb-4"
    data-testid={testId}
    direction="col"
    gap={2}>
    {children}
  </Box>
);

interface InspectorSectionHeadingProps {
  readonly count: number;
  readonly label: string;
  readonly addTestId?: string;
  readonly onAdd?: () => void;
}

export const InspectorSectionHeading = ({
  count,
  label,
  addTestId,
  onAdd,
}: InspectorSectionHeadingProps) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:min-h-8" gap={2}>
      <Typography
        aria-level={3}
        className="tw:text-primary"
        role="heading"
        size="text-sm"
        weight="semibold">
        {label}
      </Typography>
      <Badge color="gray" size="sm" type="pill-color">
        {count}
      </Badge>
      {onAdd ? (
        <Button
          className="tw:ml-auto"
          color="link-color"
          data-testid={addTestId}
          iconLeading={Plus}
          size="sm"
          type="button"
          onPress={onAdd}>
          {t('label.add')}
        </Button>
      ) : null}
    </Box>
  );
};

export const InspectorEmptyText = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <Box
    align="center"
    className="tw:min-h-14 tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:bg-surface tw:px-4 tw:py-3 tw:text-center"
    justify="center">
    <Typography as="p" className="tw:m-0 tw:text-tertiary" size="text-sm">
      {children}
    </Typography>
  </Box>
);

export const InspectorList = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <Box
    className="tw:divide-y tw:divide-secondary tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary tw:bg-surface"
    direction="col">
    {children}
  </Box>
);

interface InspectorRowProps {
  readonly children: ReactNode;
  readonly testId?: string;
}

export const InspectorRow = ({ children, testId }: InspectorRowProps) => (
  <Box
    align="center"
    className="tw:min-h-12 tw:px-3 tw:py-2"
    data-testid={testId}
    gap={3}>
    {children}
  </Box>
);

interface InspectorRemoveButtonProps {
  readonly isDisabled?: boolean;
  readonly label: string;
  readonly testId?: string;
  readonly onRemove: () => void;
}

export const InspectorRemoveButton = ({
  isDisabled,
  label,
  testId,
  onRemove,
}: InspectorRemoveButtonProps) => (
  <ButtonUtility
    color="tertiary"
    data-testid={testId}
    icon={Trash01}
    isDisabled={isDisabled}
    size="xs"
    tooltip={label}
    onClick={onRemove}
  />
);

interface InspectorFormProps {
  readonly children: ReactNode;
  readonly isSubmitDisabled: boolean;
  readonly submitLabel: string;
  readonly submitTestId?: string;
  readonly testId?: string;
  readonly title: string;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}

export const InspectorForm = ({
  children,
  isSubmitDisabled,
  submitLabel,
  submitTestId,
  testId,
  title,
  onCancel,
  onSubmit,
}: InspectorFormProps) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:px-3.5 tw:pt-3 tw:pb-3.5"
      data-testid={testId}
      direction="col"
      gap={3}>
      <Box align="center" gap={2}>
        <Typography
          className="tw:flex-1 tw:text-secondary"
          size="text-xs"
          weight="semibold">
          {title}
        </Typography>
        <ButtonUtility
          color="tertiary"
          icon={XClose}
          size="xs"
          tooltip={t('label.cancel')}
          onClick={onCancel}
        />
      </Box>
      {children}
      <Box gap={2} justify="end">
        <Button color="secondary" size="sm" type="button" onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid={submitTestId}
          isDisabled={isSubmitDisabled}
          size="sm"
          type="button"
          onPress={onSubmit}>
          {submitLabel}
        </Button>
      </Box>
    </Box>
  );
};
