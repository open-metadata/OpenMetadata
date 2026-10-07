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
import { ArrowLeft, ArrowRight } from '@openmetadata/ui-core-components/icons';
import { RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { LineageColumnMenuProps } from './LineageColumnMenu.interface';

const LineageColumnMenu = ({ onEdit }: LineageColumnMenuProps) => {
  const { t } = useTranslation();
  // Dropdown.DotsButton is a plain function component (no forwardRef), so a
  // ref placed on it never attaches in React 18 — anchor the popover to this
  // wrapper div instead, which we own and which forwardRef works on.
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="nodrag nopan tw:inline-flex"
      ref={triggerRef}
      role="presentation"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}>
      <Dropdown.Root>
        <Dropdown.DotsButton
          aria-label={t('label.lineage-options')}
          data-testid="lineage-column-menu"
        />
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label={t('label.lineage-options')}
            disallowEmptySelection={false}
            selectionMode="none"
            onAction={(key) => {
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
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
};

export default LineageColumnMenu;
