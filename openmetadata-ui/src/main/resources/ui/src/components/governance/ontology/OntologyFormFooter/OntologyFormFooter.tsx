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
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface OntologyFormFooterProps {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly canSubmit: boolean;
  readonly submitLabel: string;
  /** Overrides the dirty / clean status on the left. */
  readonly status?: ReactNode;
  readonly testId: string;
  readonly submitTestId?: string;
  /** Closes the drawer; the draft guard asks first when there are unsaved changes. */
  readonly onCancel: () => void;
  /** Actions between Cancel and submit, e.g. Validate. */
  readonly children?: ReactNode;
}

/**
 * The sticky footer of a definition form in the Studio's side drawer. It pins to the
 * bottom of the drawer's scrolling body, which pads 24px, hence the negative offsets.
 */
const OntologyFormFooter = ({
  isDirty,
  isSaving,
  canSubmit,
  submitLabel,
  status,
  testId,
  submitTestId,
  onCancel,
  children,
}: OntologyFormFooterProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:sticky tw:-bottom-6 tw:z-20 tw:-mx-6 tw:-mb-6 tw:mt-2 tw:border-t tw:border-secondary tw:bg-overlay-surface tw:px-6 tw:py-4"
      data-testid={testId}
      gap={2}>
      <div className="tw:min-w-0 tw:flex-1">
        <Typography
          color={isDirty ? 'warning' : 'secondary'}
          data-testid={`${testId}-status`}
          role="status"
          size="text-sm">
          {status ??
            t(isDirty ? 'label.unsaved-changes' : 'label.no-unsaved-changes')}
        </Typography>
      </div>
      <Button
        color="secondary"
        data-testid={`${testId}-cancel`}
        size="sm"
        onPress={onCancel}>
        {t('label.cancel')}
      </Button>
      {children}
      <Button
        color="primary"
        data-testid={submitTestId}
        isDisabled={!canSubmit}
        isLoading={isSaving}
        size="sm"
        type="submit">
        {submitLabel}
      </Button>
    </Box>
  );
};

export default OntologyFormFooter;
