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
import { TreeSelectTriggerRenderProps } from '@openmetadata/ui-core-components';
import { MouseEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import DomainSelect from '../DomainSelect/DomainSelect';
import { EditIconButton } from '../IconButtons/EditIconButton';
import { DomainSelectableListProps } from './DomainSelectableList.interface';

/**
 * Thin adapter kept for API compatibility with existing call sites: it renders
 * the go-forward {@link DomainSelect} (ui-core TreeSelect) behind the same
 * popover-trigger contract the legacy Ant Design version exposed — a custom
 * `children` trigger (or a default edit button), optional controlled open via
 * `popoverProps.open`/`onOpenChange`, and the single/multiple `onUpdate` shape.
 */
const DomainSelectableList = ({
  children,
  disabled,
  hasPermission,
  multiple = false,
  onCancel,
  onUpdate,
  popoverProps,
  restrictedDomains,
  selectedDomain,
  isClearable,
}: DomainSelectableListProps) => {
  const { t } = useTranslation();
  const { isVersionView } = useGenericContext<Domain>();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      popoverProps?.onOpenChange?.(open);
      if (!open) {
        onCancel?.();
      }
    },
    [popoverProps, onCancel]
  );

  const renderTrigger = useCallback(
    ({ toggle }: TreeSelectTriggerRenderProps) => {
      if (!children && isVersionView) {
        return null;
      }

      const trigger = children ?? (
        <EditIconButton
          newLook
          data-testid="add-domain"
          disabled={!hasPermission || disabled}
          icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
          size="small"
          title={t('label.edit-entity', { entity: t('label.domain-plural') })}
        />
      );

      // Capture the click before a child's own `stopPropagation` can swallow it,
      // so any trigger reliably opens the picker.
      return (
        <span
          role="presentation"
          onClickCapture={(e: MouseEvent<HTMLSpanElement>) => {
            if (disabled) {
              return;
            }
            e.stopPropagation();
            toggle();
          }}>
          {trigger}
        </span>
      );
    },
    [children, isVersionView, hasPermission, disabled, t]
  );

  return (
    <DomainSelect
      disabled={disabled}
      hasPermission={hasPermission}
      isClearable={isClearable}
      isOpen={popoverProps?.open}
      multiple={multiple}
      renderTrigger={renderTrigger}
      restrictedDomains={restrictedDomains}
      selectedDomain={selectedDomain}
      triggerVariant="button"
      onOpenChange={handleOpenChange}
      onUpdate={
        onUpdate as (
          domain: EntityReference | EntityReference[] | undefined
        ) => Promise<void>
      }
    />
  );
};

export default DomainSelectableList;
