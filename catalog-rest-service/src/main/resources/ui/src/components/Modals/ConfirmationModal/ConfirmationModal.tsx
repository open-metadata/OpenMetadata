import classNames from 'classnames';
import React from 'react';
import { Button } from '../../buttons/Button/Button';
type Props = {
  cancelText: string;
  confirmText: string;
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
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-w-120">
        <div className={classNames('tw-modal-header', headerClassName)}>
          <p className="tw-modal-title">{header}</p>
        </div>
        <div className={classNames('tw-modal-body tw-h-28', bodyClassName)}>
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
