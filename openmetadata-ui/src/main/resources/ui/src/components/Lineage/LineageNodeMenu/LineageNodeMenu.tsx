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
import {
  ArrowLeft,
  ArrowRight,
  Delete,
} from '@openmetadata/ui-core-components/icons';
import { RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { LineageNodeMenuProps } from './LineageNodeMenu.interface';

const LineageNodeMenu = ({
  canDelete,
  onEdit,
  onDelete,
}: LineageNodeMenuProps) => {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton
        aria-label={t('label.lineage-options')}
        className="lineage-node-menu nodrag nopan tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center"
        data-testid="lineage-node-menu"
        ref={triggerRef}
      />
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label={t('label.lineage-options')}
          disallowEmptySelection={false}
          selectionMode="none"
          onAction={(key) => {
            if (key === 'delete') {
              onDelete();

              return;
            }
            onEdit(
              key === 'upstream'
                ? LineageDirection.Upstream
                : LineageDirection.Downstream,
              triggerRef as RefObject<HTMLElement>
            );
          }}>
          <Dropdown.Item icon={ArrowLeft} id="upstream">
            {t('label.edit-upstream')}
          </Dropdown.Item>
          <Dropdown.Item icon={ArrowRight} id="downstream">
            {t('label.edit-downstream')}
          </Dropdown.Item>
          {canDelete && (
            <Dropdown.Item icon={Delete} id="delete">
              {t('label.delete')}
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default LineageNodeMenu;
