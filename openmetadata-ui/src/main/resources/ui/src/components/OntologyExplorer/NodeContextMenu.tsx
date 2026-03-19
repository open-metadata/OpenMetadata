/*
 *  Copyright 2024 Collate.
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

import { Button, Divider } from '@openmetadata/ui-core-components';
import {
  Copy01,
  InfoCircle,
  LinkExternal01,
  Target01,
} from '@untitledui/icons';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../hooks/useClipBoard';
import { showSuccessToast } from '../../utils/ToastUtils';
import { NodeContextMenuProps } from './OntologyExplorer.interface';

interface MenuItemConfig {
  key: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  isDividerBefore?: boolean;
}

const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  node,
  position,
  onClose,
  onFocus,
  onViewDetails,
  onOpenInNewTab,
}) => {
  const { t } = useTranslation();
  const { onCopyToClipBoard } = useClipboard(node.fullyQualifiedName ?? '');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target instanceof Node ? event.target : null
        )
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleCopyFQN = useCallback(async () => {
    if (node.fullyQualifiedName) {
      await onCopyToClipBoard(node.fullyQualifiedName);
      showSuccessToast(t('message.copied-to-clipboard'));
    }
    onClose();
  }, [node.fullyQualifiedName, onCopyToClipBoard, onClose, t]);

  const handleMenuClick = useCallback(
    (key: string) => {
      switch (key) {
        case 'focus':
          onFocus(node);
          onClose();

          break;
        case 'details':
          onViewDetails(node);
          onClose();

          break;
        case 'open-new-tab':
          onOpenInNewTab(node);
          onClose();

          break;
        case 'copy-fqn':
          handleCopyFQN();

          break;
        default:
          break;
      }
    },
    [node, onFocus, onViewDetails, onOpenInNewTab, handleCopyFQN, onClose]
  );

  const menuItems = useMemo<MenuItemConfig[]>(
    () => [
      {
        key: 'focus',
        icon: <Target01 size={14} />,
        label: t('label.focus-on-node'),
      },
      {
        key: 'details',
        icon: <InfoCircle size={14} />,
        label: t('label.view-detail-plural'),
      },
      {
        key: 'open-new-tab',
        icon: <LinkExternal01 size={14} />,
        label: t('label.open-in-new-tab'),
      },
      {
        key: 'copy-fqn',
        icon: <Copy01 size={14} />,
        label: t('label.copy-fqn'),
        disabled: !node.fullyQualifiedName,
        isDividerBefore: true,
      },
    ],
    [node.fullyQualifiedName, t]
  );

  return (
    <div
      className="tw:fixed tw:z-1050 tw:min-w-45 tw:rounded-lg tw:bg-white tw:py-1 tw:shadow-[0_3px_6px_-4px_rgba(0,0,0,.12),0_6px_16px_rgba(0,0,0,.08)]"
      ref={menuRef}
      style={{ top: position.y, left: position.x }}>
      {menuItems.map((item) => (
        <React.Fragment key={item.key}>
          {item.isDividerBefore && <Divider className="tw:my-1" />}
          <Button
            className="tw:w-full tw:justify-start tw:rounded-none"
            color="tertiary"
            isDisabled={item.disabled}
            size="sm"
            onClick={() => !item.disabled && handleMenuClick(item.key)}>
            <span className="tw:leading-none tw:text-gray-500">
              {item.icon}
            </span>
            {item.label}
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default NodeContextMenu;
