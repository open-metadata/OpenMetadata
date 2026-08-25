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
  Box,
  Button,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertCircle, CheckCircle } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';

export interface AssetSelectionFooterProps {
  selectedCount: number;
  errorCount: number;
  isLoading: boolean;
  isSaveLoading: boolean;
  hasAssetJobResponse: boolean;
  onCancel?: () => void;
  onSave: () => void;
}

const AssetSelectionFooter = ({
  selectedCount,
  errorCount,
  isLoading,
  isSaveLoading,
  hasAssetJobResponse,
  onCancel,
  onSave,
}: AssetSelectionFooterProps) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:w-full" justify="between">
      <Box align="center" gap={2}>
        {selectedCount >= 1 && (
          <Box align="center" gap={1}>
            <span className="tw:text-fg-success-primary tw:leading-0">
              <CheckCircle size={20} />
            </span>
            <Typography as="span" size="text-sm">
              {selectedCount} {t('label.selected-lowercase')}
            </Typography>
          </Box>
        )}
        {errorCount > 0 && (
          <>
            <Divider className="tw:mx-2" orientation="vertical" />
            <Box align="center" gap={1}>
              <span className="tw:text-fg-error-primary">
                <AlertCircle size={20} />
              </span>
              <Typography
                as="span"
                className="tw:text-error-primary"
                size="text-sm">
                {errorCount} {t('label.error')}
              </Typography>
            </Box>
          </>
        )}
      </Box>

      <Box gap={4}>
        <Button color="tertiary" data-testid="cancel-btn" onClick={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-btn"
          isDisabled={
            !selectedCount || isLoading || isSaveLoading || hasAssetJobResponse
          }
          isLoading={isSaveLoading || hasAssetJobResponse}
          onClick={onSave}>
          {t('label.save')}
        </Button>
      </Box>
    </Box>
  );
};

export default AssetSelectionFooter;
