/*
 *  Copyright 2023 Collate.
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
import { Button, Popover, Select, Tooltip, Typography } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as ClosePopoverIcon } from '../../../assets/svg/popover-close.svg';
import { ReactComponent as SavePopoverIcon } from '../../../assets/svg/popover-save.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/user-profile-edit.svg';

import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import './domain-select-dropdown.less';
import { DomainSelectableListProps } from './DomainSelectableList.interface';

export const DomainListItemRenderer = (props: EntityReference) => {
  const isSubDomain = Fqn.split(props.fullyQualifiedName ?? '').length > 1;
  const fqn = `(${props.fullyQualifiedName ?? ''})`;

  return (
    <div className="d-flex items-center gap-2">
      <DomainIcon
        color={DE_ACTIVE_COLOR}
        height={20}
        name="folder"
        width={20}
      />
      <div className="d-flex items-center w-max-400">
        <Typography.Text ellipsis>{getEntityName(props)}</Typography.Text>
        {isSubDomain && (
          <Typography.Text
            ellipsis
            className="m-l-xss text-xs"
            type="secondary">
            {fqn}
          </Typography.Text>
        )}
      </div>
    </div>
  );
};

const DomainSelectableList = ({
  children,
  domains,
  multiple = false,
  onUpdate,
  selectedDomain,
}: DomainSelectableListProps) => {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const [popupVisible, setPopupVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [currentlySelectedDomains, setCurrentlySelectedDomains] = useState<
    EntityReference[]
  >([]);

  const selectedDomainsList = useMemo(() => {
    if (selectedDomain) {
      return Array.isArray(selectedDomain) ? selectedDomain : [selectedDomain];
    }

    return [];
  }, [selectedDomain]);

  const handleUpdate = async () => {
    setIsSaving(true);

    try {
      if (multiple) {
        await onUpdate(currentlySelectedDomains);
      } else {
        await onUpdate(currentlySelectedDomains[0]);
      }
    } finally {
      setIsSaving(false);
      setPopupVisible(false);
    }
  };

  const handleClosePopup = () => {
    setPopupVisible(false);
  };
  const [popoverHeight, setPopoverHeight] = useState<number>(136);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dropdown = document.querySelector(
        '.ant-select-dropdown'
      ) as HTMLElement;

      if (dropdown) {
        setPopoverHeight(dropdown.scrollHeight + 136);
      }
    });

    const dropdown = document.querySelector('.ant-select-dropdown');
    if (dropdown) {
      observer.observe(dropdown, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => observer.disconnect();
  }, [isDropdownOpen]);

  return (
    // Used Button to stop click propagation event anywhere in the component to parent
    // TeamDetailV1 collapsible panel
    <Button
      className="remove-button-default-styling"
      onClick={(e) => e.stopPropagation()}>
      <Popover
        destroyTooltipOnHide
        content={
          <div
            className="user-profile-edit-popover-card relative"
            style={{
              height: `${popoverHeight}px`,
            }}>
            <div className="d-flex justify-start items-center gap-2 m-b-sm">
              <div className="d-flex flex-start items-center">
                <DomainIcon height={16} />
              </div>

              <Typography.Text className="user-profile-edit-popover-card-title">
                {t('label.domain')}
              </Typography.Text>
            </div>

            <div className="border" style={{ borderRadius: '5px' }}>
              <Select
                allowClear
                className="profile-edit-popover"
                defaultValue={selectedDomainsList.map((domain) => domain.id)}
                maxTagCount={3}
                maxTagPlaceholder={(omittedValues) => (
                  <span className="max-tag-text">
                    {t('label.plus-count-more', {
                      count: omittedValues.length,
                    })}
                  </span>
                )}
                mode="multiple"
                options={domains?.map((domain) => ({
                  label: domain.displayName || domain.name,
                  value: domain.id,
                }))}
                placeholder="Please select"
                ref={dropdownRef as any}
                style={{ width: '100%' }}
                onChange={(selectedIds) => {
                  const selectedDomainList = domains.filter((domain) =>
                    selectedIds.includes(domain.id)
                  );
                  setCurrentlySelectedDomains(selectedDomainList as any);
                }}
                onDropdownVisibleChange={(open) => {
                  setIsDropdownOpen(open);
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                className="profile-edit-save"
                data-testid="inline-cancel-btn"
                icon={
                  <ClosePopoverIcon height={24} style={{ marginTop: '2px' }} />
                }
                size="small"
                style={{
                  width: '30px',
                  height: '30px',
                  background: '#0950C5',
                  position: 'absolute',
                  bottom: '0px',
                  right: '38px',
                }}
                type="primary"
                onClick={handleClosePopup}
              />

              <Button
                className="profile-edit-cancel"
                data-testid="inline-save-btn"
                icon={
                  <SavePopoverIcon height={24} style={{ marginTop: '2px' }} />
                }
                loading={isSaving}
                size="small"
                style={{
                  width: '30px',
                  height: '30px',
                  background: '#0950C5',
                  position: 'absolute',
                  bottom: '0px',
                }}
                type="primary"
                onClick={handleUpdate}
              />
            </div>
          </div>
        }
        open={popupVisible}
        overlayClassName="profile-edit-popover-card"
        placement="bottomLeft"
        showArrow={false}
        style={{ borderRadius: '12px' }}
        trigger="click"
        onOpenChange={setPopupVisible}>
        {children ?? (
          <Tooltip
            title={t('label.edit-entity', {
              entity: t('label.persona'),
            })}>
            <EditIcon
              className="cursor-pointer"
              data-testid="edit-persona"
              height={16}
            />
          </Tooltip>
        )}
      </Popover>
    </Button>
  );
};

export default DomainSelectableList;
