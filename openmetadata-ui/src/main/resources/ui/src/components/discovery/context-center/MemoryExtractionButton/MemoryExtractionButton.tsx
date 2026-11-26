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
import { RefreshCw01, Stars01 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import {
  MemoryExtractionAction,
  MEMORY_EXTRACTION_ACTION_LABEL_KEYS,
} from '../../../../constants/ContextCenter.constants';
import {
  MemoryExtractionOptions,
  useMemoryExtraction,
} from '../../../../hooks/discovery/context-center/useMemoryExtraction';

/** Extract or Retry beside a document's extraction status, for its owners and admins. */
const MemoryExtractionButton = <T,>(props: MemoryExtractionOptions<T>) => {
  const { t } = useTranslation();
  const { action, disabledReasonKey, isRequesting, requestExtraction } =
    useMemoryExtraction(props);

  if (!action) {
    return null;
  }

  const button = (
    <Button
      showTextWhileLoading
      color="secondary"
      data-testid="memory-extraction-btn"
      iconLeading={
        action === MemoryExtractionAction.Retry ? RefreshCw01 : Stars01
      }
      isDisabled={Boolean(disabledReasonKey)}
      isLoading={isRequesting}
      size="xs"
      onClick={requestExtraction}>
      {t(MEMORY_EXTRACTION_ACTION_LABEL_KEYS[action])}
    </Button>
  );

  return disabledReasonKey ? (
    <Tooltip placement="top" title={t(disabledReasonKey)}>
      {button}
    </Tooltip>
  ) : (
    button
  );
};

export default MemoryExtractionButton;
