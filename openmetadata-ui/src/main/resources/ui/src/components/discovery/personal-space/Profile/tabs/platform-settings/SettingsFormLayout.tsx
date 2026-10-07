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
  Box,
  Button,
  HookForm,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface SettingsFormSectionProps {
  title: string;
  children: ReactNode;
}

/** Uppercase caption above a bordered card laying its fields out in two columns. */
export const SettingsFormSection = ({
  title,
  children,
}: SettingsFormSectionProps) => (
  <Box direction="col" gap={3}>
    <Typography
      className="tw:px-1 tw:text-primary-900 tw:uppercase"
      size="text-xs"
      weight="medium">
      {title}
    </Typography>
    <div className="tw:grid tw:grid-cols-1 tw:gap-x-8 tw:gap-y-5 tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary tw:p-6 tw:md:grid-cols-2">
      {children}
    </div>
  </Box>
);

interface SettingsFormLayoutProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  testId: string;
  showHint: boolean;
  isSaving: boolean;
  isSaveDisabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: T) => void | Promise<void>;
  children: ReactNode;
}

const SettingsFormLayout = <T extends FieldValues>({
  form,
  testId,
  showHint,
  isSaving,
  isSaveDisabled = false,
  onCancel,
  onSubmit,
  children,
}: SettingsFormLayoutProps<T>) => {
  const { t } = useTranslation();

  return (
    <HookForm
      className="tw:flex tw:h-full tw:min-h-0 tw:flex-col"
      data-testid={testId}
      fieldDocDisplay="popover"
      form={form}
      renderFieldDoc={(text) => (
        <Typography className="tw:text-tertiary" size="text-sm">
          {text}
        </Typography>
      )}
      showFieldDocs={showHint}
      onSubmit={form.handleSubmit(onSubmit)}>
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0">
        <Box className="tw:max-w-240" direction="col" gap={8}>
          {children}
        </Box>
      </div>
      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-8 tw:py-4"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-button"
          isDisabled={isSaving}
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-button"
          isDisabled={isSaveDisabled}
          isLoading={isSaving}
          type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default SettingsFormLayout;

export const SettingsSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <Box
    className="tw:rounded-[10px] tw:border tw:border-secondary tw:p-5"
    data-testid="settings-skeleton"
    direction="col"
    gap={4}>
    {Array.from({ length: rows }, (_, index) => (
      <Skeleton height={20} key={index} variant="rounded" width="100%" />
    ))}
  </Box>
);
