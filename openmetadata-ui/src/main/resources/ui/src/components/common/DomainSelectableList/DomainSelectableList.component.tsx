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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/user-profile-edit.svg';
import {
  DE_ACTIVE_COLOR,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getDomainList } from '../../../rest/domainAPI';
import { searchData } from '../../../rest/miscAPI';
import { formatDomainsResponse } from '../../../utils/APIUtils';
import { Transi18next } from '../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import { getDomainPath } from '../../../utils/RouterUtils';
import { SelectableList } from '../SelectableList/SelectableList.component';
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
          <Typography.Text ellipsis className="m-l-xss text-xs">
            {/* {fqn} */}
          </Typography.Text>
        )}
      </div>
    </div>
  );
};

const DomainSelectableList = ({
  onUpdate,
  children,
  hasPermission,
  popoverProps,
  selectedDomain,
  multiple = false,
}: DomainSelectableListProps) => {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const [popupVisible, setPopupVisible] = useState(false);

  const selectedDomainsList = useMemo(() => {
    if (selectedDomain) {
      return Array.isArray(selectedDomain) ? selectedDomain : [selectedDomain];
    }

    return [];
  }, [selectedDomain]);

  const fetchOptions = async (searchText: string, after?: string) => {
    if (searchText) {
      try {
        const res = await searchData(
          searchText,
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
          after: after ?? undefined,
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
      if (multiple) {
        await onUpdate(domains);
      } else {
        await onUpdate(domains[0]);
      }
      setPopupVisible(false);
    },
    [onUpdate, multiple]
  );

  return (
    // Used Button to stop click propagation event anywhere in the component to parent
    // TeamDetailV1 collapsible panel
    <Button
      className="remove-button-default-styling"
      onClick={(e) => e.stopPropagation()}>
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
                    style={{ color: theme.primaryColor }}
                    target="_blank"
                  />
                }
                values={{
                  link: t('label.domain-plural'),
                }}
              />
            }
            fetchOptions={fetchOptions}
            multiSelect={multiple}
            removeIconTooltipLabel={t('label.remove-entity', {
              entity: t('label.domain-lowercase'),
            })}
            searchPlaceholder={t('label.search-for-type', {
              type: t('label.domain'),
            })}
            selectedItems={selectedDomainsList}
            onCancel={() => setPopupVisible(false)}
            onUpdate={handleUpdate}
          />
        }
        open={popupVisible}
        overlayClassName="domain-select-popover"
        placement="right"
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
              icon={<EditIcon height={16} />}
              size="small"
              type="text"
            />
          </Tooltip>
        )}
      </Popover>
    </Button>
  );
};

export default DomainSelectableList;
