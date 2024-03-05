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
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import {
  DE_ACTIVE_COLOR,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getDomainList } from '../../../rest/domainAPI';
import { searchData } from '../../../rest/miscAPI';
import { formatDomainsResponse } from '../../../utils/APIUtils';
import { Transi18next } from '../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../utils/EntityUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { SelectableList } from '../SelectableList/SelectableList.component';
import './domain-select-dropdown.less';
import { DomainSelectableListProps } from './DomainSelectableList.interface';

export const DomainListItemRenderer = (props: EntityReference) => {
  return (
    <div className="d-flex items-center gap-2">
      <DomainIcon
        color={DE_ACTIVE_COLOR}
        height={20}
        name="folder"
        width={20}
      />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </div>
  );
};

const DomainSelectableList = ({
  onUpdate,
  children,
  hasPermission,
  popoverProps,
  selectedDomain,
}: DomainSelectableListProps) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);

  const fetchOptions = async (searchText: string) => {
    if (searchText) {
      try {
        const res = await searchData(
          encodeURIComponent(searchText),
          1,
          PAGE_SIZE_MEDIUM,
          '',
          '',
          '',
          SearchIndex.DOMAIN
        );

        const data = getEntityReferenceListFromEntities(
          formatDomainsResponse(res.data.hits.hits),
          EntityType.DOMAIN
        );

        return { data, paging: { total: res.data.hits.total.value } };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    } else {
      try {
        const { data, paging } = await getDomainList({
          limit: PAGE_SIZE_MEDIUM,
        });
        const filterData = getEntityReferenceListFromEntities(
          data,
          EntityType.DOMAIN
        );

        return { data: filterData, paging };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    }
  };

  const handleUpdate = useCallback(
    async (domains: EntityReference[]) => {
      await onUpdate(domains[0]);
      setPopupVisible(false);
    },
    [onUpdate]
  );

  return (
    <Popover
      destroyTooltipOnHide
      content={
        <SelectableList
          customTagRenderer={DomainListItemRenderer}
          emptyPlaceholderText={
            <Transi18next
              i18nKey="message.no-domain-available"
              renderElement={
                <a
                  href={getDomainPath()}
                  rel="noreferrer"
                  style={{ color: '#1890ff' }}
                  target="_blank"
                />
              }
              values={{
                link: t('label.domain-plural'),
              }}
            />
          }
          fetchOptions={fetchOptions}
          multiSelect={false}
          removeIconTooltipLabel={t('label.remove-entity', {
            entity: t('label.domain-lowercase'),
          })}
          searchPlaceholder={t('label.search-for-type', {
            type: t('label.domain'),
          })}
          selectedItems={selectedDomain ? [selectedDomain] : []}
          onCancel={() => setPopupVisible(false)}
          onUpdate={handleUpdate}
        />
      }
      open={popupVisible}
      overlayClassName="domain-select-popover"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}
      {...popoverProps}>
      {children ?? (
        <Tooltip
          placement="topRight"
          title={
            hasPermission
              ? t('label.edit-entity', {
                  entity: t('label.domain'),
                })
              : NO_PERMISSION_FOR_ACTION
          }>
          <Button
            className="p-0 flex-center"
            data-testid="add-domain"
            disabled={!hasPermission}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
            size="small"
            type="text"
          />
        </Tooltip>
      )}
    </Popover>
  );
};

export default DomainSelectableList;
