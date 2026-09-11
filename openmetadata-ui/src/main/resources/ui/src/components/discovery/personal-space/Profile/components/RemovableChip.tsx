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

import { Badge, Button } from '@openmetadata/ui-core-components';
import { X } from '@untitledui/icons';
import React from 'react';

interface RemovableChipProps {
  label: string;
  // Stable hook for the remove control so e2e can target a specific chip.
  testId: string;
  isDisabled?: boolean;
  onRemove: () => void;
}

/**
 * A selected-value chip for the profile edit rows. Mirrors the ui-core
 * BadgeWithButton look (gray modern badge + trailing remove button) but exposes
 * a `data-testid` on the remove button, which BadgeWithButton does not.
 */
const RemovableChip: React.FC<RemovableChipProps> = ({
  label,
  testId,
  isDisabled,
  onRemove,
}) => (
  <Badge color="gray" size="lg" type="modern">
    <span className="tw:max-w-40 tw:truncate">{label}</span>
    <Button
      className="tw:ml-1"
      color="tertiary"
      data-testid={testId}
      iconLeading={X}
      isDisabled={isDisabled}
      size="xs"
      onPress={onRemove}
    />
  </Badge>
);

export default RemovableChip;
