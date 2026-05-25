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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { Copy01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { CopyableUrlFieldProps } from './CopyableUrlField.interface';

export const CopyableUrlField = ({
  label,
  value,
  testId,
}: CopyableUrlFieldProps) => {
  const { t } = useTranslation();

  const handleCopy = async () => {
    try {
      await globalThis.navigator.clipboard.writeText(value);
      showSuccessToast(t('message.copied-to-clipboard'));
    } catch {
      showErrorToast(t('message.copy-to-clipboard'));
    }
  };

  return (
    <div className="copyable-url-field" data-testid={testId}>
      {label && (
        <Typography as="span" className="copyable-url-label" size="text-xs">
          {label}
        </Typography>
      )}
      <div className="copyable-url-value-wrapper">
        <Typography
          as="span"
          className="copyable-url-value"
          data-testid={`${testId}-value`}>
          {value}
        </Typography>
        <Button
          color="tertiary"
          data-testid={`${testId}-copy`}
          iconLeading={Copy01}
          size="sm"
          onPress={handleCopy}>
          {t('label.copy')}
        </Button>
      </div>
    </div>
  );
};

export const CallbackUrlWidget = ({ id, value }: WidgetProps) => (
  <CopyableUrlField
    label=""
    testId={id}
    value={typeof value === 'string' ? value : ''}
  />
);
