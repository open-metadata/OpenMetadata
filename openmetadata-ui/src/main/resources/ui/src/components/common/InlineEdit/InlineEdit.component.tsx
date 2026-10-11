/*
 *  Copyright 2023 Collate.
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
import { Box, Button } from '@openmetadata/ui-core-components';
import { Check, XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import './inline-edit.less';
import { InlineEditProps } from './InlineEdit.interface';

const InlineEdit = ({
  children,
  onCancel,
  onSave,
  direction,
  className,
  isLoading,
  cancelButtonProps,
  saveButtonProps,
}: InlineEditProps) => {
  const { t } = useTranslation();
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  const isVertical = direction === 'vertical';

  return (
    <Box
      align={isVertical ? undefined : 'center'}
      className={classNames(className, 'inline-edit-container')}
      data-testid="inline-edit-container"
      direction={isVertical ? 'col' : 'row'}
      gap={2}
      // Used onClick to stop click propagation event anywhere in the component to parent
      // TeamDetailsV1 and User.component collapsible panel.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}>
      {children}

      <Box data-testid="buttons" gap={1} justify="end">
        <Button
          aria-label={t('label.cancel')}
          color="primary"
          data-testid="inline-cancel-btn"
          iconLeading={XClose}
          isDisabled={isLoading}
          size="xs"
          onPress={onCancel}
          {...cancelButtonProps}
        />
        <Button
          aria-label={t('label.save')}
          color="primary"
          data-testid="inline-save-btn"
          iconLeading={Check}
          isLoading={isLoading}
          size="xs"
          onPress={onSave}
          {...saveButtonProps}
        />
      </Box>
    </Box>
  );
};

export default InlineEdit;
