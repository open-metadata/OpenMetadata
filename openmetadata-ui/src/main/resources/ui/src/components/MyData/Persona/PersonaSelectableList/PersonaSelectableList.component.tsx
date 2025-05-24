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
import { Button, Popover, Select, Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as PersonaIcon } from '../../../../assets/svg/ic-persona-new.svg';
import { ReactComponent as ClosePopoverIcon } from '../../../../assets/svg/ic-popover-close.svg';
import { ReactComponent as SavePopoverIcon } from '../../../../assets/svg/ic-popover-save.svg';

import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { getAllPersonas } from '../../../../rest/PersonaAPI';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../../utils/EntityUtils';
import { TagRenderer } from '../../../common/TagRenderer/TagRenderer';
import { PersonaSelectableListProps } from './PersonaSelectableList.interface';

export const PersonaListItemRenderer = (props: EntityReference) => {
  const { t } = useTranslation();

  return (
    <Space>
      {props ? (
        <Typography.Text>{getEntityName(props)}</Typography.Text>
      ) : (
        <Typography.Text className="text-grey-body">
          {t('message.no-data-available')}
        </Typography.Text>
      )}
    </Space>
  );
};

export const PersonaSelectableList = ({
  hasPermission,
  selectedPersonas = [],
  onUpdate,
  children,
  popoverProps,
  personaList,
  isDefaultPersona,
}: PersonaSelectableListProps) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const [allPersona, setAllPersona] = useState<EntityReference[]>(
    personaList ?? []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [currentlySelectedPersonas, setCurrentlySelectedPersonas] =
    useState<any>([]);
  const [popoverHeight, setPopoverHeight] = useState<number>(
    isDefaultPersona ? 116 : 156
  );
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dropdown = document.querySelector(
        '.persona-custom-dropdown-class'
      ) as HTMLElement;

      if (dropdown) {
        setPopoverHeight(
          dropdown.scrollHeight + (isDefaultPersona ? 116 : 156)
        );
      }
    });

    const dropdown = document.querySelector('.persona-custom-dropdown-class');
    if (dropdown) {
      observer.observe(dropdown, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => observer.disconnect();
  }, [isDropdownOpen]);

  const fetchOptions = async (searchText: string, after?: string) => {
    if (searchText) {
      try {
        const filteredData = allPersona.filter(
          (persona) =>
            persona.displayName?.includes(searchText) ||
            persona.name?.includes(searchText) ||
            persona.description?.includes(searchText)
        );

        return { data: filteredData, paging: { total: filteredData.length } };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    } else {
      try {
        if (personaList) {
          return { data: personaList, paging: { total: personaList.length } };
        }
        const { data, paging } = await getAllPersonas({
          limit: PAGE_SIZE_LARGE,
          after: after ?? undefined,
        });
        const filterData = getEntityReferenceListFromEntities(
          data,
          EntityType.PERSONA
        );

        setAllPersona(filterData);

        return { data: filterData, paging };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    }
  };
  const [selectOptions, setSelectOptions] = useState<EntityReference[]>([]);

  const loadOptions = async () => {
    const { data } = await fetchOptions('');
    setSelectOptions(data);
  };

  useEffect(() => {
    loadOptions();
  }, [personaList]);

  const handlePersonaUpdate = () => {
    setIsSaving(true);

    Promise.resolve(
      onUpdate(
        isDefaultPersona
          ? currentlySelectedPersonas[0]
          : currentlySelectedPersonas
      )
    ).finally(() => {
      setIsSaving(false);
      setPopupVisible(false);
    });
  };

  if (!hasPermission) {
    return null;
  }
  const handleCloseEditTeam = () => {
    setPopupVisible(false);
  };

  return (
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
              <PersonaIcon height={16} />
            </div>

            <Typography.Text className="user-profile-edit-popover-card-title">
              {isDefaultPersona
                ? t('label.default-persona')
                : t('label.persona')}
            </Typography.Text>
          </div>

          <div className="border" id="area" style={{ borderRadius: '5px' }}>
            <Select
              allowClear
              className={classNames('profile-edit-popover', {
                'single-select': isDefaultPersona,
              })}
              data-testid="persona-select-list"
              defaultValue={selectedPersonas.map((persona) => persona.id)}
              dropdownStyle={{
                maxHeight: '200px',
                overflow: 'auto',
              }}
              maxTagCount={3}
              maxTagPlaceholder={(omittedValues) => (
                <span className="max-tag-text">
                  {t('label.plus-count-more', { count: omittedValues.length })}
                </span>
              )}
              mode={!isDefaultPersona ? 'multiple' : undefined}
              options={selectOptions?.map((persona) => ({
                label: persona.displayName || persona.name,
                value: persona.id,
                className: 'font-normal',
              }))}
              placeholder="Please select"
              popupClassName="persona-custom-dropdown-class"
              ref={dropdownRef as any}
              style={{ width: '100%' }}
              tagRender={TagRenderer}
              onChange={(selectedIds) => {
                const selectedPersonasList = selectOptions.filter((persona) =>
                  selectedIds.includes(persona.id)
                );
                setCurrentlySelectedPersonas(selectedPersonasList);
              }}
              onDropdownVisibleChange={(open) => {
                setIsDropdownOpen(open);
              }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              className="persona-profile-edit-save"
              data-testid="user-profile-persona-edit-cancel"
              icon={<ClosePopoverIcon height={24} />}
              size="small"
              type="primary"
              onClick={handleCloseEditTeam}
            />
            <Button
              className="persona-profile-edit-cancel"
              data-testid="user-profile-persona-edit-save"
              icon={<SavePopoverIcon height={24} />}
              loading={isSaving}
              size="small"
              type="primary"
              onClick={handlePersonaUpdate}
            />
          </div>
        </div>
      }
      data-testid="persona-popover"
      open={popupVisible}
      overlayClassName="profile-edit-popover-card"
      placement="bottomLeft"
      showArrow={false}
      style={{ borderRadius: '12px' }}
      trigger="click"
      onOpenChange={setPopupVisible}
      {...popoverProps}>
      {children ?? (
        <Tooltip
          title={t('label.edit-entity', {
            entity: t('label.persona'),
          })}>
          <EditIcon
            className="cursor-pointer"
            data-testid="edit-user-persona"
            height={16}
          />
        </Tooltip>
      )}
    </Popover>
  );
};
