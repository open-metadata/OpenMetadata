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
import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

export interface CollapseHeaderMenuItem {
  key: string;
  label: string;
  onClick: () => void;
}

interface CollapseHeaderProps {
  title: string;
  menuItems?: CollapseHeaderMenuItem[];
  handleAddNewBoost?: () => void;
  dataTestId?: string;
}

const CollapseHeader = ({
  title,
  menuItems,
  dataTestId,
  handleAddNewBoost,
}: CollapseHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="d-flex items-center justify-between">
      <Typography className="text-md font-semibold">{title}</Typography>
      {menuItems ? (
        <Dropdown.Root>
          <Button
            data-testid={dataTestId}
            iconLeading={<Plus size={14} />}
            size="sm">
            {t('label.add')}
          </Button>
          <Dropdown.Popover placement="bottom start">
            <Dropdown.Menu
              aria-label={t('label.add')}
              className="tw:max-h-70 tw:overflow-y-auto"
              selectionMode="none">
              {menuItems.map((item) => (
                <Dropdown.Item
                  id={item.key}
                  key={item.key}
                  label={item.label}
                  onAction={item.onClick}
                />
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      ) : (
        <Button
          data-testid={dataTestId}
          iconLeading={<Plus size={14} />}
          size="sm"
          onPress={handleAddNewBoost}>
          {t('label.add')}
        </Button>
      )}
    </div>
  );
};

export default CollapseHeader;
