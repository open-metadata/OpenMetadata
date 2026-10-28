/*
 *  Copyright 2026 Collate.
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
  ConfirmPopover,
  ConfirmPopoverProps,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteType } from './DeleteWidget.interface';
import { useEntityDelete, UseEntityDeleteOptions } from './useEntityDelete';

export type DeleteEntityPopoverProps = UseEntityDeleteOptions &
  Pick<
    ConfirmPopoverProps,
    | 'children'
    | 'triggerRef'
    | 'isOpen'
    | 'onOpenChange'
    | 'onCancel'
    | 'placement'
  > & {
    /**
     * Offer a soft delete. When set, the popover asks Soft delete (selected by
     * default) or Delete permanently, as `DeleteEntityModal` does; otherwise
     * confirm is a permanent delete. @default true
     */
    allowSoftDelete?: boolean;
    /** Replaces the default soft/permanent delete explanation. */
    description?: ReactNode;
    'data-testid'?: string;
  };

/**
 * Anchored delete confirmation for an entity, the popover counterpart of
 * `DeleteEntityModal`: a soft / permanent choice with the safer soft delete
 * selected, and a confirm button named after the choice.
 */
const DeleteEntityPopover = ({
  allowSoftDelete = true,
  'data-testid': dataTestId = 'delete-entity-popover',
  children,
  description,
  triggerRef,
  isOpen,
  onOpenChange,
  onCancel,
  placement,
  ...deleteOptions
}: DeleteEntityPopoverProps) => {
  const { t } = useTranslation();
  const deleteEntityWith = useEntityDelete(deleteOptions);
  const entity = startCase(deleteOptions.entityType).toLowerCase();
  const defaultType = allowSoftDelete
    ? DeleteType.SOFT_DELETE
    : DeleteType.HARD_DELETE;
  const [deleteType, setDeleteType] = useState<DeleteType>(defaultType);

  // The popover stays mounted around its trigger, so every open and close
  // starts again from the safer default rather than a choice left behind.
  const handleOpenChange = (open: boolean) => {
    setDeleteType(defaultType);
    onOpenChange?.(open);
  };

  useEffect(() => {
    setDeleteType(defaultType);
  }, [defaultType]);

  const options = [
    {
      type: DeleteType.SOFT_DELETE,
      label: t('label.soft-delete'),
      hint: t('message.soft-delete-common-message', { entity }),
    },
    {
      type: DeleteType.HARD_DELETE,
      label: t('label.permanently-delete'),
      hint: t('message.permanently-delete-common-message', { entity }),
    },
  ];
  const selectedOption =
    options.find((option) => option.type === deleteType) ?? options[0];

  const choice = allowSoftDelete ? (
    <RadioGroup
      aria-label={t('label.delete-entity', {
        entity: deleteOptions.entityName,
      })}
      className="tw:gap-2"
      data-testid={`${dataTestId}-options`}
      size="sm"
      value={deleteType}
      onChange={(value) => setDeleteType(value as DeleteType)}>
      {options.map((option) => (
        <RadioButton
          data-testid={`${dataTestId}-${option.type}`}
          hint={option.hint}
          key={option.type}
          label={
            <Typography
              as="span"
              color={
                option.type === DeleteType.HARD_DELETE ? 'danger' : undefined
              }
              size="text-sm"
              weight="semibold">
              {option.label}
            </Typography>
          }
          size="sm"
          value={option.type}
          variant="card"
        />
      ))}
    </RadioGroup>
  ) : undefined;

  return (
    <ConfirmPopover
      // The soft / permanent choice carries two descriptions, so it is wider
      // than the default confirmation.
      className={allowSoftDelete ? 'tw:w-90' : undefined}
      confirmText={allowSoftDelete ? selectedOption.label : undefined}
      content={choice}
      data-testid={dataTestId}
      description={
        description ??
        (allowSoftDelete
          ? undefined
          : t('message.permanently-delete-common-message', { entity }))
      }
      isOpen={isOpen}
      placement={placement}
      title={t('label.delete-entity', {
        entity: deleteOptions.entityName,
      })}
      triggerRef={triggerRef}
      onCancel={onCancel}
      onConfirm={() => deleteEntityWith(deleteType)}
      onOpenChange={handleOpenChange}>
      {children}
    </ConfirmPopover>
  );
};

export default DeleteEntityPopover;
