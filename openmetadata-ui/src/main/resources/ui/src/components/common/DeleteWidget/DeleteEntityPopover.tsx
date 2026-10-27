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
import classNames from 'classnames';
import { startCase } from 'lodash';
import { ReactNode, useState } from 'react';
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
  const [deleteType, setDeleteType] = useState<DeleteType>(
    allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
  );

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
      className="tw:gap-1"
      data-testid={`${dataTestId}-options`}
      size="sm"
      value={deleteType}
      onChange={(value) => setDeleteType(value as DeleteType)}>
      {options.map((option) => (
        <RadioButton
          className={({ isSelected }) =>
            classNames(
              'tw:cursor-pointer tw:rounded-lg tw:p-2',
              isSelected && 'tw:bg-secondary'
            )
          }
          data-testid={`${dataTestId}-${option.type}`}
          hint={
            <Typography as="span" className="tw:text-tertiary" size="text-sm">
              {option.hint}
            </Typography>
          }
          key={option.type}
          label={
            <Typography
              as="span"
              className={
                option.type === DeleteType.HARD_DELETE
                  ? 'tw:text-error-primary'
                  : 'tw:text-primary'
              }
              size="text-sm"
              weight="semibold">
              {option.label}
            </Typography>
          }
          size="sm"
          value={option.type}
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
      onOpenChange={onOpenChange}>
      {children}
    </ConfirmPopover>
  );
};

export default DeleteEntityPopover;
