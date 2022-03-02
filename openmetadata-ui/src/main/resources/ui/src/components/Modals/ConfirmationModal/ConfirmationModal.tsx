/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import React, { ReactNode } from 'react';
import { Button } from '../../buttons/Button/Button';
type Props = {
  cancelText: string | ReactNode;
  confirmText: string | ReactNode;
  bodyText: string;
  header: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  confirmButtonCss?: string;
  cancelButtonCss?: string;
  onConfirm: () => void;
  onCancel: () => void;
};
const ConfirmationModal = ({
  cancelText,
  confirmText,
  header,
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  confirmButtonCss = '',
  cancelButtonCss = '',
  onConfirm,
  onCancel,
  bodyText,
}: Props) => {
  return (
    <dialog className="tw-modal" data-testid="confirmation-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-w-120">
        <div className={classNames('tw-modal-header', headerClassName)}>
          <p className="tw-modal-title" data-testid="modal-header">
            {header}
          </p>
        </div>
        <div
          className={classNames('tw-modal-body tw-h-28', bodyClassName)}
          data-testid="body-text">
          <p>{bodyText}</p>
        </div>
        <div
          className={classNames(
            'tw-modal-footer tw-justify-end',
            footerClassName
          )}>
          <Button
            className={classNames('tw-mr-2', cancelButtonCss)}
            data-testid="cancel"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            className={confirmButtonCss}
            data-testid="save-button"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default ConfirmationModal;
