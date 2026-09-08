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

import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { Link as AriaLink } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExpandPanelIcon } from '../../../../assets/svg/expand-panel.svg';
import { RailItem } from './Rail';

export interface SubRailProps {
  items: RailItem[];
  onExpand: () => void;
}

const SubRail: React.FC<SubRailProps> = ({ items, onExpand }) => {
  const { t } = useTranslation();

  return (
    <div className="ask-sub-rail" data-testid="ask-sub-rail">
      <div className="ask-sub-rail__header">
        <button
          aria-label={t('label.expand')}
          className="ask-sub-rail__expand-btn"
          data-testid="ask-sub-rail-expand-btn"
          type="button"
          onClick={onExpand}>
          <ExpandPanelIcon height={20} width={20} />
        </button>
      </div>

      <nav className="ask-sub-rail__nav">
        {items.map((item) => {
          const Icon =
            item.isActive && item.activeIcon ? item.activeIcon : item.icon;

          const itemClassName = classNames('ask-sub-rail__item', {
            'ask-sub-rail__item--active': item.isActive,
          });

          // Navigable items render as anchors (react-aria Link) so the
          // browser's open-in-new-tab affordances work; the button branch
          // is a fallback for any action-only item.
          return (
            <Tooltip arrow key={item.key} placement="right" title={item.label}>
              {item.href ? (
                <AriaLink
                  aria-label={item.label}
                  className={itemClassName}
                  data-testid={`ask-sub-rail-item-${item.key}`}
                  href={item.href}>
                  <Icon height={20} width={20} />
                </AriaLink>
              ) : (
                <TooltipTrigger>
                  <button
                    aria-label={item.label}
                    className={itemClassName}
                    data-testid={`ask-sub-rail-item-${item.key}`}
                    type="button"
                    onClick={item.onClick}>
                    <Icon height={20} width={20} />
                  </button>
                </TooltipTrigger>
              )}
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );
};

export default SubRail;
