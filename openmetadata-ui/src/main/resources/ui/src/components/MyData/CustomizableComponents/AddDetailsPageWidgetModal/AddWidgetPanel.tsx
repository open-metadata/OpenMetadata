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
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface AddWidgetPanelProps {
  children: ReactNode;
  /** Left of the footer buttons: what will be added, or why it cannot be. */
  summary?: ReactNode;
  canAdd: boolean;
  onAdd: () => void;
  onCancel: () => void;
}

/** One widget's pane in the Add Widget dialog: scrolling body, fixed footer. */
export const AddWidgetPanel = ({
  children,
  summary,
  canAdd,
  onAdd,
  onCancel,
}: AddWidgetPanelProps) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:h-full tw:min-h-0" direction="col">
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-6">
        {children}
      </div>
      <Box
        align="center"
        className="tw:border-t tw:border-secondary tw:px-6 tw:py-4"
        gap={3}
        justify="between">
        <Typography
          className="tw:min-w-0 tw:text-tertiary"
          data-testid="add-widget-summary"
          size="text-sm">
          {summary}
        </Typography>
        <Box className="tw:shrink-0" gap={3}>
          <Button color="secondary" size="md" onPress={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="add-widget-button"
            isDisabled={!canAdd}
            size="md"
            onPress={onAdd}>
            {t('label.add-entity', { entity: t('label.widget') })}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
