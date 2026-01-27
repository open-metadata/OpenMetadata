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
import { Button, Popover, Tooltip, Typography } from 'antd';
import { RefSelectProps as BaseSelectRef } from 'antd/es/select';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { EntityReference } from '../../../generated/entity/type';
import DomainSelectablTreeNew from '../DomainSelectableTree/DomainSelectableTreeNew';
import './domain-select-dropdown.less';
import { DomainSelectableListProps } from './DomainSelectableList.interface';

const DomainSelectableListNew = ({
  hasPermission,
  multiple = false,
  onUpdate,
  selectedDomain,
  isClearable,
}: DomainSelectableListProps) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const selectedDomainsList = useMemo(() => {
    if (selectedDomain) {
      return Array.isArray(selectedDomain)
        ? selectedDomain.map((item) => item.fullyQualifiedName)
        : [selectedDomain.fullyQualifiedName];
    }

    return [];
  }, [selectedDomain]);

  const initialDomains = useMemo(() => {
    if (selectedDomain) {
      return Array.isArray(selectedDomain) ? selectedDomain : [selectedDomain];
    }

    return [];
  }, [selectedDomain]);

  const handleUpdate = async (domains: EntityReference[]) => {
    try {
      if (multiple) {
        await onUpdate(domains);
      } else {
        await onUpdate(domains[0]);
      }
    } finally {
      setPopupVisible(false);
    }
  };

  const [popoverHeight, setPopoverHeight] = useState<number>(156);
  const dropdownRef = useRef<BaseSelectRef>(null);

  useEffect(() => {
    setIsDropdownOpen(popupVisible);
  }, [popupVisible]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dropdown = document.querySelector(
        '.domain-custom-dropdown-class'
      ) as HTMLElement;

      if (dropdown) {
        const newHeight = Math.min(dropdown.scrollHeight + 161, 350);
        setPopoverHeight(newHeight);
      }
    });

    const dropdown = document.querySelector('.domain-custom-dropdown-class');
    if (dropdown) {
      observer.observe(dropdown, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => observer.disconnect();
  }, [isDropdownOpen]);
  const handleDropdownChange = (open: boolean) => {
    setIsDropdownOpen(open);
  };

  return (
    <Button
      className="remove-button-default-styling"
      onClick={(e) => e.stopPropagation()}>
      <Popover
        destroyTooltipOnHide
        content={
          <div
            className="user-profile-edit-popover-card"
            style={{
              height: `${popoverHeight}px`,
            }}>
            <div className="d-flex justify-start items-center gap-2 m-b-sm">
              <div className="d-flex flex-start items-center">
                <DomainIcon height={16} />
              </div>

              <Typography.Text className="user-profile-edit-popover-card-title">
                {t('label.domain-plural')}
              </Typography.Text>
            </div>
            <DomainSelectablTreeNew
              dropdownRef={dropdownRef}
              handleDropdownChange={handleDropdownChange}
              initialDomains={initialDomains}
              isClearable={isClearable}
              isMultiple={multiple}
              open={isDropdownOpen}
              value={selectedDomainsList as string[]}
              visible={popupVisible}
              onCancel={() => setPopupVisible(false)}
              onSubmit={handleUpdate}
            />
          </div>
        }
        open={popupVisible}
        overlayClassName="profile-edit-popover-card"
        placement="bottomLeft"
        showArrow={false}
        style={{ borderRadius: '12px' }}
        trigger="click"
        onOpenChange={setPopupVisible}>
        {hasPermission && (
          <Tooltip
            title={t('label.edit-entity', {
              entity: t('label.domain-plural'),
            })}>
            <EditIcon
              className="cursor-pointer"
              data-testid="edit-domains"
              height={16}
            />
          </Tooltip>
        )}
      </Popover>
    </Button>
  );
};

export default DomainSelectableListNew;
