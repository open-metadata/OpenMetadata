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
  Box,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowLeft,
  Check,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

export type IncidentStatusPopoverHeaderProps = {
  title: string;
  cancelTestId: string;
  submitTestId: string;
  submitDisabled: boolean;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export const IncidentStatusPopoverHeader = ({
  title,
  cancelTestId,
  submitTestId,
  submitDisabled,
  onBack,
  onCancel,
  onSubmit,
}: IncidentStatusPopoverHeaderProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:p-3"
      direction="row"
      gap={2}
      justify="start">
      <ButtonUtility
        icon={ArrowLeft}
        size="xs"
        tooltip={t('label.back')}
        onClick={onBack}
      />
      <Typography size="text-sm" weight="semibold">
        {title}
      </Typography>
      <span className="tw:flex-1" />
      <ButtonUtility
        data-testid={cancelTestId}
        icon={XClose}
        size="sm"
        tooltip={t('label.cancel')}
        onClick={onCancel}
      />
      <ButtonUtility
        data-testid={submitTestId}
        icon={Check}
        isDisabled={submitDisabled}
        size="sm"
        tooltip={t('label.save')}
        onClick={onSubmit}
      />
    </Box>
  );
};
