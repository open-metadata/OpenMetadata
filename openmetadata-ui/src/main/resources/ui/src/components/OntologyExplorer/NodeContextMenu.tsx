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

import { Button } from '@openmetadata/ui-core-components';
import {
  Copy01,
  Expand01,
  InfoCircle,
  LinkExternal01,
  Plus,
  Share01,
  Target01,
} from '@untitledui/icons';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../hooks/useClipBoard';
import { showSuccessToast } from '../../utils/ToastUtils';
import { OntologyNode } from './OntologyExplorer.interface';

export interface NodeContextMenuProps {
  node: OntologyNode;
  position: { x: number; y: number };
  onClose: () => void;
  onFocus: (node: OntologyNode) => void;
  onViewDetails: (node: OntologyNode) => void;
  onOpenInNewTab: (node: OntologyNode) => void;
  onAddRelation?: (node: OntologyNode) => void;
  onExpandNeighbors?: (node: OntologyNode, depth: number) => void;
}

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
  onAddRelation,
  onExpandNeighbors,
}) => {
  const { t } = useTranslation();
  const { onCopyToClipBoard } = useClipboard(node.fullyQualifiedName ?? '');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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
        case 'add-relation':
          onAddRelation?.(node);
          onClose();

          break;
        case 'reveal-relations':
          onExpandNeighbors?.(node, 1);
          onClose();

          break;
        case 'expand-2':
          onExpandNeighbors?.(node, 2);
          onClose();

          break;
        default:
          break;
      }
    },
    [
      node,
      onFocus,
      onViewDetails,
      onOpenInNewTab,
      onAddRelation,
      onExpandNeighbors,
      handleCopyFQN,
      onClose,
    ]
  );

  const menuItems = useMemo<MenuItemConfig[]>(() => {
    const items: MenuItemConfig[] = [
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
    ];

    if (onAddRelation && node.type !== 'dataAsset') {
      items.push({
        key: 'add-relation',
        icon: <Plus size={14} />,
        label: t('label.add-entity', { entity: t('label.relation') }),
        isDividerBefore: true,
      });
    }

    if (onExpandNeighbors) {
      items.push(
        {
          key: 'reveal-relations',
          icon: <Share01 size={14} />,
          label: t('label.expand-1-hops'),
          isDividerBefore: true,
        },
        {
          key: 'expand-2',
          icon: <Expand01 size={14} />,
          label: t('label.expand-2-hops'),
        }
      );
    }

    return items;
  }, [node.fullyQualifiedName, node.type, onAddRelation, onExpandNeighbors, t]);

  return (
    <div
      className="node-context-menu"
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 1050,
        background: '#ffffff',
        borderRadius: 8,
        boxShadow: '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px rgba(0,0,0,.08)',
        minWidth: 180,
        padding: '4px 0',
      }}>
      {menuItems.map((item) => (
        <React.Fragment key={item.key}>
          {item.isDividerBefore && (
            <hr
              style={{
                margin: '4px 0',
                border: 'none',
                borderTop: '1px solid #f0f0f0',
              }}
            />
          )}
          <Button
            color="tertiary"
            isDisabled={item.disabled}
            size="sm"
            style={{
              width: '100%',
              justifyContent: 'flex-start',
              borderRadius: 0,
            }}
            onClick={() => !item.disabled && handleMenuClick(item.key)}>
            <span style={{ color: 'rgba(0,0,0,0.45)', lineHeight: 0 }}>
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
