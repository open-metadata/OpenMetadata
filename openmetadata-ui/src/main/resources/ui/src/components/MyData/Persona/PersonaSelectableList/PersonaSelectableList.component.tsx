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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Popover, Select, Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PersonaIcon } from '../../../../assets/svg/persona (2).svg';
import { ReactComponent as EditIcon } from '../../../../assets/svg/user-profile-edit.svg';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { getAllPersonas } from '../../../../rest/PersonaAPI';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../../utils/EntityUtils';
import { PersonaSelectableListProps } from './PersonaSelectableList.interface';

export const PersonaListItemRenderer = (props: EntityReference) => {
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
  multiSelect = false,
  personaList,
  isDefaultPersona,
}: PersonaSelectableListProps) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const [allPersona, setAllPersona] = useState<EntityReference[]>(
    personaList ?? []
  );
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [currentlySelectedPersonas, setCurrentlySelectedPersonas] =
    useState<any>([]);

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
  }, []);

  // const handlePersonaUpdate = useCallback(() => {
  //   onUpdate(currentlySelectedPersonas);
  // }, [onUpdate, currentlySelectedPersonas]);
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
      setPopupVisible(false); // Close popover after saving
    });
  };

  if (!hasPermission) {
    return null;
  }
  const handleDropdownChange = (visible: boolean) => {
    setIsSelectOpen(visible);
  };
  const handleCloseEditTeam = () => {
    setIsSelectOpen(false);
  };

  return (
    <Popover
      destroyTooltipOnHide
      content={
        <div className="user-profile-edit-popover-card">
          <div className="d-flex justify-start items-center gap-2 m-b-xss">
            <div className="user-page-icon d-flex-center">
              <PersonaIcon height={16} />
            </div>

            <Typography.Text className="user-profile-edit-popover-card-title">
              {t('label.persona')}
            </Typography.Text>
          </div>

          <div
            className="border"
            // className={!isDropdownOpen ? 'border' : ''}
            id="area"
            // style={
            //   isDropdownOpen
            //     ? { height: '350px' }
            //     : { borderRadius: '5px', height: 'auto' }
            // }
          >
            <Select
              allowClear
              className={classNames('profile-edit-popover', {
                'single-select': isDefaultPersona, // Apply class when it's single select
              })}
              defaultValue={selectedPersonas.map((persona) => persona.id)}
              getPopupContainer={(triggerNode) =>
                triggerNode.closest('.profile-edit-popover-card')
              }
              maxTagCount={3}
              maxTagPlaceholder={(omittedValues) =>
                `+${omittedValues.length} more`
              }
              mode={!isDefaultPersona ? 'multiple' : undefined}
              options={selectOptions?.map((persona) => ({
                label: persona.displayName || persona.name,
                value: persona.id,
              }))}
              placeholder="Please select"
              style={{ width: '100%' }}
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
          {!isSelectOpen && (
            <div className="flex justify-end gap-2 m-t-xs">
              <Button
                data-testid="inline-cancel-btn"
                icon={<CloseOutlined />}
                size="small"
                style={{
                  width: '30px',
                  height: '30px',
                  background: '#0950C5',
                }}
                type="primary"
                onClick={handleCloseEditTeam}
              />
              <Button
                data-testid="inline-save-btn"
                icon={<CheckOutlined />}
                loading={isSaving}
                size="small"
                style={{ width: '30px', height: '30px', background: '#0950C5' }}
                type="primary"
                onClick={handlePersonaUpdate as any}
              />
            </div>
          )}
        </div>
      }
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
            data-testid="edit-persona"
            height={16}
          />
        </Tooltip>
      )}
    </Popover>
    // </Button>
  );
};
