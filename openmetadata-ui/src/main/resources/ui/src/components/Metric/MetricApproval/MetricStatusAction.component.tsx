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
import { Box, Button, TextArea } from '@openmetadata/ui-core-components';
import { CheckCircle, XCircle } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

export interface MetricStatusActionProps {
  onApprove: () => void;
  onReject: () => void;
  note: string;
  onNoteChange: (note: string) => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  rejectRequiresNote?: boolean;
  dataTestId?: string;
}

const MetricStatusAction: FC<MetricStatusActionProps> = ({
  onApprove,
  onReject,
  note,
  onNoteChange,
  isDisabled,
  isLoading,
  rejectRequiresNote = true,
  dataTestId = 'metric-approval',
}) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:w-full" direction="col" gap={3}>
      <TextArea
        aria-label={t('label.note')}
        data-testid={`${dataTestId}-note`}
        isDisabled={isDisabled || isLoading}
        placeholder={t('label.note')}
        rows={3}
        value={note}
        onChange={onNoteChange}
      />
      <Box className="tw:flex-wrap" gap={2} justify="end">
        <Button
          color="secondary-destructive"
          data-testid={`${dataTestId}-reject-btn`}
          iconLeading={XCircle}
          isDisabled={
            isDisabled || isLoading || (rejectRequiresNote && !note.trim())
          }
          isLoading={isLoading}
          size="sm"
          onPress={onReject}>
          {t('label.reject')}
        </Button>
        <Button
          color="primary"
          data-testid={`${dataTestId}-approve-btn`}
          iconLeading={CheckCircle}
          isDisabled={isDisabled || isLoading}
          isLoading={isLoading}
          size="sm"
          onPress={onApprove}>
          {t('label.approve')}
        </Button>
      </Box>
    </Box>
  );
};

export default MetricStatusAction;
