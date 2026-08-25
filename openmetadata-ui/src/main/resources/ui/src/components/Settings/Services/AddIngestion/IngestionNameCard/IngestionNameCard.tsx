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

import { Input } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface IngestionNameCardProps {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onFocus?: (fieldName: string) => void;
}

const IngestionNameCard = ({
  displayName,
  onDisplayNameChange,
  onFocus,
}: IngestionNameCardProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-5 tw:shadow-xs"
      data-testid="ingestion-name-card">
      <div className="tw:text-sm tw:font-semibold tw:leading-6 tw:text-primary">
        {t('label.name-this-ingestion')}
      </div>
      <div className="tw:mt-0.5 tw:text-xs tw:text-tertiary">
        {t('message.name-this-ingestion-description')}
      </div>
      <div className="tw:my-3 tw:h-px tw:bg-[var(--tw-color-border-secondary)]" />
      <Input
        isRequired
        id="ingestion-display-name"
        inputDataTestId="ingestion-display-name"
        label={t('label.name')}
        placeholder={t('label.name')}
        value={displayName}
        onChange={onDisplayNameChange}
        onFocus={() => onFocus?.('displayName')}
      />
    </div>
  );
};

export default IngestionNameCard;
