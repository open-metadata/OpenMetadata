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
  Card,
  Dropdown,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterResourceDescriptor } from '../../../../../../generated/events/filterResourceDescriptor';
import { EntityIconSize } from '../../../../../../utils/EntityIconUtils';
import { getEntityNameLabel } from '../../../../../../utils/EntityNameUtils';
import searchClassBase from '../../../../../../utils/SearchClassBase';

interface NotificationSourceSelectProps {
  filterResources: FilterResourceDescriptor[];
  value: string[];
  onChange: (resources: string[]) => void;
  isViewMode?: boolean;
}

function NotificationSourceSelect({
  filterResources,
  value,
  onChange,
  isViewMode = false,
}: Readonly<NotificationSourceSelectProps>) {
  const { t } = useTranslation();
  const hasSource = value.length > 0;
  const resources = useMemo(
    () => filterResources.map((r) => r.name ?? ''),
    [filterResources]
  );

  const handleSourceChange = useCallback(
    (val: string) => onChange([val]),
    [onChange]
  );

  return (
    <Card className="tw:w-full" size="md">
      <Card.Content>
        <Box direction="col" gap={3}>
          <Box direction="col" gap={1}>
            <Typography size="text-sm" weight="medium">
              {t('label.source')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('message.alerts-source-description')}
            </Typography>
          </Box>

          {hasSource ? (
            <Select
              className="tw:w-full"
              data-testid="source-select"
              isDisabled={isViewMode}
              items={resources.map((name) => ({
                id: name,
                label: getEntityNameLabel(name),
              }))}
              placeholder={t('label.select-field', {
                field: t('label.data-asset-plural'),
              })}
              selectedKey={value[0] ?? null}
              onSelectionChange={(key) =>
                !isViewMode && key && handleSourceChange(String(key))
              }>
              {(item) => (
                <Select.Item id={item.id} key={item.id}>
                  <Box align="center" direction="row" gap={2}>
                    {searchClassBase.getEntityIconWithBg(
                      item.id,
                      EntityIconSize.Size14
                    )}
                    <Typography>{item.label}</Typography>
                  </Box>
                </Select.Item>
              )}
            </Select>
          ) : (
            <Box className="tw:self-start">
              <Dropdown.Root>
                <Button color="primary" data-testid="add-source-button">
                  {t('label.add-entity', {
                    entity: t('label.source'),
                  })}
                </Button>
                <Dropdown.Popover placement="bottom left">
                  <Box
                    className="tw:py-1 tw:px-1.5 tw:max-h-60 tw:overflow-y-auto"
                    direction="col">
                    <Typography
                      className="tw:text-tertiary tw:px-2.5 tw:py-1"
                      size="text-xs">
                      {t('label.data-asset-plural')}
                    </Typography>
                    <Dropdown.Menu
                      onAction={(key) => handleSourceChange(String(key))}>
                      {resources.map((name) => (
                        <Dropdown.Item
                          id={name}
                          key={name}
                          textValue={getEntityNameLabel(name)}>
                          <Box
                            inline
                            align="center"
                            direction="row"
                            gap={2}>
                            {searchClassBase.getEntityIconWithBg(
                              name,
                              EntityIconSize.Size14
                            )}
                            {getEntityNameLabel(name)}
                          </Box>
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Box>
                </Dropdown.Popover>
              </Dropdown.Root>
            </Box>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
}

export default NotificationSourceSelect;
