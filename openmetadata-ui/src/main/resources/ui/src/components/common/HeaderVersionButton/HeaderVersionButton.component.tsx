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
import { Button, Tooltip } from '@openmetadata/ui-core-components';
import { RefreshCcw01 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

interface HeaderVersionButtonProps {
  version: string;
  onClick: () => void;
}

/** The entity's current version in a page header; opens its version history. */
export const HeaderVersionButton = ({
  version,
  onClick,
}: HeaderVersionButtonProps) => {
  const { t } = useTranslation();

  return (
    <Tooltip title={t('label.version-plural')}>
      <Button
        className="tw:p-1.5"
        color="secondary"
        data-testid="version-btn"
        iconLeading={RefreshCcw01}
        size="sm"
        onClick={onClick}>
        {version}
      </Button>
    </Tooltip>
  );
};
