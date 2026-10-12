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

import { Badge, ButtonUtility } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isNumber } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as CollapsePanelIcon } from '../../../../assets/svg/collapse-panel.svg';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { emitIntent } from '../useIntent';
import { resolveActiveSubNavKey, SubNavConfig, SubNavItem } from './navConfig';

export interface SubPanelProps {
  config: SubNavConfig;
  onCollapse: () => void;
  /**
   * Runtime counts keyed by `SubNavItem.key`. A `number` (including 0)
   * overrides the static `item.badgeCount`; `undefined` falls back.
   */
  badges?: Record<string, number | undefined>;
  /** Extra sections rendered below the static config sections. */
  dynamicSections?: React.ReactNode;
}

const SubPanel: React.FC<SubPanelProps> = ({
  config,
  onCollapse,
  badges,
  dynamicSections,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();

  const { permissions } = usePermissionProvider();

  const activeKey = useMemo(
    () => resolveActiveSubNavKey(config.sections, pathname, state),
    [config, pathname, state]
  );

  // Drop items the user isn't allowed to act on. Sections are kept even
  // when emptied so a partially-gated group doesn't lose its header.
  const sections = useMemo(
    () =>
      config.sections.map((section) => ({
        ...section,
        items: section.items.filter(
          ({ requiredPermission: required }) =>
            !required ||
            Boolean(permissions?.[required.resource]?.[required.operation])
        ),
      })),
    [config.sections, permissions]
  );

  const handleItemClick = useCallback(
    (item: SubNavItem) => {
      if (item.intent) {
        emitIntent(item.intent);

        return;
      }
      if (item.path) {
        navigate(item.path);
      }
    },
    [navigate]
  );

  return (
    <div className="ask-sub-panel" data-testid="ask-sub-panel">
      <header className="ask-sub-panel__header">
        <span
          className="ask-sub-panel__title"
          data-testid="ask-sub-panel-title">
          {t(config.titleKey)}
        </span>
        <ButtonUtility
          color="tertiary"
          data-testid="ask-sub-panel-collapse-btn"
          icon={CollapsePanelIcon}
          size="sm"
          tooltip={t('label.collapse')}
          type="button"
          onClick={onCollapse}
        />
      </header>

      {sections.map((section, idx) => (
        // Sections never reorder, so index is a stable React key.
        <section
          className={classNames('ask-sub-panel__section', {
            'ask-sub-panel__section--with-header': Boolean(section.headerKey),
          })}
          key={section.headerKey ?? idx}>
          {section.showDivider ? (
            <hr className="ask-sub-panel__divider" />
          ) : null}
          {section.headerKey ? (
            <div
              className={classNames('ask-sub-panel__section-header', {
                'ask-sub-panel__section-header--branded': Boolean(
                  section.headerIcon
                ),
                'ask-sub-panel__section-header--with-badge':
                  Boolean(section.headerBadgeKey) && !section.headerIcon,
              })}>
              {section.headerIcon ? (
                <section.headerIcon className="ask-sub-panel__section-header-icon" />
              ) : null}
              <span>{t(section.headerKey)}</span>
              {section.headerBadgeKey ? (
                <Badge color="brand" size="sm">
                  {t(section.headerBadgeKey)}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <ul className="ask-sub-panel__list">
            {section.items.map((item) => {
              const label = t(item.labelKey);
              const isActive = activeKey === item.key;
              const Icon =
                isActive && item.activeIcon ? item.activeIcon : item.icon;
              const count = badges?.[item.key] ?? item.badgeCount;
              const itemClassName = classNames('ask-sub-panel__item', {
                'ask-sub-panel__item--active': activeKey === item.key,
                'ask-sub-panel__item--emphasized': item.emphasized,
              });
              const inner = (
                <>
                  {Icon ? (
                    <span className="ask-sub-panel__item-icon">
                      <Icon height={20} width={20} />
                    </span>
                  ) : null}
                  <span className="ask-sub-panel__item-label">{label}</span>
                  {isNumber(count) ? (
                    <Badge color={item.badgeColor ?? 'gray'} size="sm">
                      {count}
                    </Badge>
                  ) : null}
                </>
              );

              // Intent items fire an action (no route); path items render
              // as anchors so cmd/ctrl-click, middle-click and the
              // right-click "open in new tab" menu work.
              return (
                <li key={item.key}>
                  {item.path && !item.intent ? (
                    <Link
                      aria-label={label}
                      className={itemClassName}
                      data-testid={`ask-sub-panel-item-${item.key}`}
                      to={item.path}>
                      {inner}
                    </Link>
                  ) : (
                    <button
                      aria-label={label}
                      className={itemClassName}
                      data-testid={`ask-sub-panel-item-${item.key}`}
                      type="button"
                      onClick={() => handleItemClick(item)}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {dynamicSections}
    </div>
  );
};

export default SubPanel;
