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
import { Button, Popover, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import DomainSelectablTree from '../DomainSelectableTree/DomainSelectableTree';
import { FocusTrapWithContainer } from '../FocusTrap/FocusTrapWithContainer';
import { EditIconButton } from '../IconButtons/EditIconButton';
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
  onUpdate,
  children,
  hasPermission,
  popoverProps,
  selectedDomain,
  multiple = false,
  onCancel,
  wrapInButton = true,
  showAllDomains = false,
}: DomainSelectableListProps) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const { isVersionView } = useGenericContext<Domain>();

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

  const handleCancel = useCallback(() => {
    setPopupVisible(false);
    onCancel?.();
  }, [onCancel]);

  const popoverContent = useMemo(() => {
    return (
      <Popover
        destroyTooltipOnHide
        content={
          <FocusTrapWithContainer active={popoverProps?.open || false}>
            <DomainSelectablTree
              initialDomains={initialDomains}
              isMultiple={multiple}
              showAllDomains={showAllDomains}
              value={selectedDomainsList as string[]}
              visible={popupVisible || Boolean(popoverProps?.open)}
              onCancel={handleCancel}
              onSubmit={handleUpdate}
            />
          </FocusTrapWithContainer>
        }
        open={popupVisible}
        overlayClassName="domain-select-popover w-400"
        placement="bottomRight"
        showArrow={false}
        trigger="click"
        onOpenChange={setPopupVisible}
        {...popoverProps}>
        {children ??
          (!isVersionView && (
            <EditIconButton
              newLook
              data-testid="add-domain"
              disabled={!hasPermission}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.domain-plural'),
              })}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
      </Popover>
    );
  }, [
    children,
    hasPermission,
    handleCancel,
    handleUpdate,
    initialDomains,
    multiple,
    popoverProps,
    popupVisible,
    selectedDomainsList,
    isVersionView,
  ]);

  if (wrapInButton) {
    return (
      <Button
        className="remove-button-default-styling flex-center"
        onClick={(e) => e.stopPropagation()}>
        {popoverContent}
      </Button>
    );
  }

  return popoverContent;
};

export default DomainSelectableList;
