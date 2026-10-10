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
import {
  CheckCircle,
  DotsVertical,
  Edit01,
  XCircle,
} from '@openmetadata/ui-core-components/icons';
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import React, { Key, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';
import { Tab } from '../../../generated/system/ui/tab';
import { getTabDisplayName } from '../../../utils/CustomizePage/CustomizePageEntityTabUtils';

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

interface TabItemProps {
  item: Tab;
  index: number;
  moveTab?: (fromIndex: number, toIndex: number) => void;
  onEdit?: (key: string) => void;
  onRename?: (key: string) => void;
  onRemove?: (targetKey: TargetKey) => void;
  onItemClick?: (key: string) => void;
  shouldHide?: boolean;
  /** Offers "Edit widgets"; defaults to the tab's own editable flag. */
  isEditable?: boolean;
}

export const TabItem = ({
  item,
  index,
  moveTab,
  onEdit,
  onRename,
  onRemove,
  onItemClick,
  shouldHide,
  isEditable = item.editable,
}: TabItemProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [{ isDragging }, drag] = useDrag({
    type: 'TAB',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const tabMenuItems = [
    ...(isEditable
      ? [
          {
            label: t('label.edit-widget-plural'),
            key: 'edit',
            icon: CheckCircle,
          },
        ]
      : []),
    {
      label: t('label.rename'),
      key: 'rename',
      icon: Edit01,
    },
    {
      label: shouldHide ? t('label.hide') : t('label.delete'),
      key: 'delete',
      icon: XCircle,
    },
  ];

  const handleMenuClick = (key: Key, itemId: string) => {
    switch (key) {
      case 'edit':
        onEdit?.(itemId);

        break;
      case 'rename':
        onRename?.(itemId);

        break;
      case 'delete':
        onRemove?.(itemId);

        break;
    }
  };

  const [, drop] = useDrop({
    accept: 'TAB',
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveTab?.(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      style={{ opacity: isDragging ? 0.5 : 1 }}>
      {/* MenuTrigger opens on mouse press-start, whose underlay would swallow
          the drop of a drag; open on press instead, which a drag never fires. */}
      <Dropdown.Root
        isOpen={isMenuOpen}
        onOpenChange={(open) => !open && setIsMenuOpen(false)}>
        <Button
          className="draggable-tab-item tw:cursor-move tw:hover:cursor-grab tw:active:cursor-grabbing"
          color="secondary"
          data-testid={`tab-${item.name}`}
          iconTrailing={DotsVertical}
          onPress={() => {
            onItemClick?.(item.id);
            setIsMenuOpen(true);
          }}>
          {getTabDisplayName(item)}
        </Button>
        <Dropdown.Popover className="tw:w-auto" placement="bottom start">
          <Dropdown.Menu
            aria-label={getTabDisplayName(item)}
            selectionMode="none"
            onAction={(key) => handleMenuClick(key, item.id)}>
            {tabMenuItems.map((menuItem) => (
              <Dropdown.Item
                icon={menuItem.icon}
                id={menuItem.key}
                key={menuItem.key}
                label={menuItem.label}
              />
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
};
