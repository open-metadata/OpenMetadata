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
import { Dropdown } from '@openmetadata/ui-core-components';
import { RefreshCw01, Stars01 } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { Text } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
  MemoryExtractionAction,
  MEMORY_EXTRACTION_ACTION_LABEL_KEYS,
  MEMORY_EXTRACTION_MENU_ITEM_KEY,
} from '../../../../constants/ContextCenter.constants';
import { MemoryExtraction } from '../../../../hooks/discovery/context-center/useMemoryExtraction';

/**
 * Extract or Retry in a document's menu; it runs its own action, as react-aria items can. Keyboard
 * navigation skips a disabled item, so its reason is a visible line, and the item's description.
 */
const MemoryExtractionMenuItem: FC<MemoryExtraction> = ({
  action,
  disabledReasonKey,
  isRequesting,
  requestExtraction,
}) => {
  const { t } = useTranslation();

  if (!action) {
    return null;
  }

  const label = t(MEMORY_EXTRACTION_ACTION_LABEL_KEYS[action]);

  return (
    <Dropdown.Item
      data-testid="memory-extraction-menu-btn"
      icon={action === MemoryExtractionAction.Retry ? RefreshCw01 : Stars01}
      id={MEMORY_EXTRACTION_MENU_ITEM_KEY}
      isDisabled={Boolean(disabledReasonKey) || isRequesting}
      textValue={label}
      onAction={requestExtraction}>
      <Text slot="label">{label}</Text>
      {disabledReasonKey && (
        <Text
          className="tw:block tw:whitespace-normal tw:text-xs tw:text-tertiary"
          slot="description">
          {t(disabledReasonKey)}
        </Text>
      )}
    </Dropdown.Item>
  );
};

export default MemoryExtractionMenuItem;
