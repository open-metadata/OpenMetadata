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
  ButtonUtility,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, Edit01, XClose } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReadOnlyRow } from '../../../components/SettingsSection';

interface NumberSettingRowProps {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  isDisabled?: boolean;
  /** Resolves to whether the value was saved; the editor stays open if not. */
  onSave: (value: number) => Promise<boolean>;
}

/** A numeric global setting, edited in place and saved on its own. */
const NumberSettingRow = ({
  name,
  label,
  value,
  min,
  max,
  isDisabled,
  onSave,
}: NumberSettingRowProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const draftNumber = draft?.trim() ? Number(draft) : Number.NaN;
  const isValid =
    Number.isInteger(draftNumber) && draftNumber >= min && draftNumber <= max;

  const save = async () => {
    setIsSaving(true);
    try {
      if (await onSave(draftNumber)) {
        setDraft(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ReadOnlyRow
      description={`${min} – ${max}`}
      testId={`global-setting-${name}`}
      title={label}>
      {draft === null ? (
        <Box align="center" direction="row" gap={2}>
          <Typography
            className="tw:font-mono"
            data-testid={`global-setting-value-${name}`}
            size="text-sm"
            weight="semibold">
            {value}
          </Typography>
          <ButtonUtility
            color="tertiary"
            data-testid={`global-setting-edit-${name}`}
            icon={Edit01}
            isDisabled={isDisabled}
            size="xs"
            tooltip={t('label.edit')}
            onPress={() => setDraft(String(value))}
          />
        </Box>
      ) : (
        <Box align="center" direction="row" gap={1}>
          <Input
            aria-label={label}
            className="tw:w-32"
            inputDataTestId={`global-setting-input-${name}`}
            isInvalid={!isValid}
            type="number"
            value={draft}
            onChange={setDraft}
          />
          <ButtonUtility
            color="tertiary"
            data-testid={`global-setting-save-${name}`}
            icon={Check}
            isDisabled={!isValid || isSaving}
            size="xs"
            tooltip={t('label.save')}
            onPress={save}
          />
          <ButtonUtility
            color="tertiary"
            data-testid={`global-setting-cancel-${name}`}
            icon={XClose}
            isDisabled={isSaving}
            size="xs"
            tooltip={t('label.cancel')}
            onPress={() => setDraft(null)}
          />
        </Box>
      )}
    </ReadOnlyRow>
  );
};

export default NumberSettingRow;
