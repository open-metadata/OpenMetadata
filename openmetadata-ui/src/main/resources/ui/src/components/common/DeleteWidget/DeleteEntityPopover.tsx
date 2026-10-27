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
} from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteType } from './DeleteWidget.interface';
import {
  useEntityDelete,
  UseEntityDeleteOptions,
} from '../../../hooks/common/useEntityDelete';

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
     * Offer a soft delete. When set, Soft delete is the default (confirm)
     * action and permanent delete the secondary one, as in
     * `DeleteEntityModal`. @default true
     */
    allowSoftDelete?: boolean;
    /** Replaces the default soft/permanent delete explanation. */
    description?: ReactNode;
    'data-testid'?: string;
  };

/**
 * Anchored delete confirmation for an entity, the popover counterpart of
 * `DeleteEntityModal`. Soft and permanent delete are two footer actions
 * rather than a radio choice; the safer soft delete is the default one.
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

  return (
    <ConfirmPopover
      actions={
        allowSoftDelete
          ? [
              {
                key: DeleteType.HARD_DELETE,
                label: t('label.permanently-delete'),
                color: 'secondary-destructive',
                onPress: () => deleteEntityWith(DeleteType.HARD_DELETE),
                'data-testid': `${dataTestId}-hard-delete`,
              },
            ]
          : []
      }
      confirmText={allowSoftDelete ? t('label.soft-delete') : undefined}
      data-testid={dataTestId}
      description={
        description ?? (
          <>
            {allowSoftDelete && (
              <p>{t('message.soft-delete-common-message', { entity })}</p>
            )}
            <p>{t('message.permanently-delete-common-message', { entity })}</p>
          </>
        )
      }
      isOpen={isOpen}
      placement={placement}
      title={t('label.delete-entity', {
        entity: deleteOptions.entityName,
      })}
      triggerRef={triggerRef}
      onCancel={onCancel}
      onConfirm={() =>
        deleteEntityWith(
          allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
        )
      }
      onOpenChange={onOpenChange}>
      {children}
    </ConfirmPopover>
  );
};

export default DeleteEntityPopover;
