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
  Button,
  Tab,
  TabList,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete } from '@openmetadata/ui-core-components/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { QueryBuilderGroupHeaderProps } from './QueryBuilderCanvas.types';
import { toFieldNodes } from './QueryBuilderCanvas.utils';
import QueryBuilderControl from './QueryBuilderControl';

const QueryBuilderGroupHeader: FC<QueryBuilderGroupHeaderProps> = ({
  conjunction,
  groupField,
  path,
  context,
  canRemove,
}) => {
  const { t } = useTranslation();
  const { actions, config, preset, readonly, showConjunction } = context;
  const conjunctions = Object.keys(config.conjunctions ?? {});
  // A fixed-conjunction caller still shows which conjunction applies; it just cannot change it.
  const canSetConjunction = !readonly && conjunctions.length > 1;
  const levelItems = useMemo(
    () => (groupField ? toFieldNodes(config.fields) : []),
    [config, groupField]
  );
  // Nothing to choose between, or a caller that says its rules only ever combine one way: the helper text still says
  // which way that is.
  const hasConjunctionControl = showConjunction && conjunctions.length > 1;

  return (
    <Box align="center" gap={3}>
      {hasConjunctionControl && (
        <Tabs
          className="tw:w-auto"
          selectedKey={conjunction}
          onSelectionChange={(key) =>
            actions.setConjunction(path, String(key))
          }>
          <TabList
            data-testid="advanced-search-conjunction"
            size="sm"
            type="button-border">
            {conjunctions.map((key) => (
              <Tab
                data-testid={`advanced-search-conjunction-${key.toLowerCase()}`}
                id={key}
                isDisabled={!canSetConjunction}
                key={key}>
                {key}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      )}

      {groupField && (
        <div className="tw:w-56">
          <QueryBuilderControl
            dataTestId="advanced-search-group-field-select"
            items={levelItems}
            label={t('label.field')}
            placeholder={t('label.field')}
            readonly={readonly}
            render={config.settings.renderField}
            selectedKey={groupField.field}
            onChange={(key: string) =>
              actions.setField(groupField.path as never, key as never)
            }
          />
        </div>
      )}

      <Typography className="tw:text-tertiary" size="text-xs">
        {conjunction === 'OR'
          ? t('message.any-condition-can-match')
          : t('message.all-conditions-must-match')}
      </Typography>

      {canRemove && !readonly && (
        <Button
          aria-label={t('label.remove')}
          className="tw:ml-auto"
          color="link-destructive"
          data-testid={preset.testIds.delGroup}
          iconLeading={Delete}
          size="sm"
          onClick={() => actions.removeGroup(path)}
        />
      )}
    </Box>
  );
};

export default QueryBuilderGroupHeader;
