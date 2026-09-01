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
import { Button } from '@openmetadata/ui-core-components';
import { XCircle } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';

interface LineageNodeRemoveButtonProps {
  onRemove: () => void;
}

const LineageNodeRemoveButton = ({
  onRemove,
}: LineageNodeRemoveButtonProps) => {
  const { t } = useTranslation();

  return (
    <Button
      aria-label={t('label.remove')}
      className="lineage-node-remove-btn tw:absolute tw:-top-5 tw:-right-5"
      color="tertiary"
      data-testid="lineage-node-remove-btn"
      iconLeading={XCircle}
      size="xs"
      onPress={onRemove}
    />
  );
};

export default LineageNodeRemoveButton;
