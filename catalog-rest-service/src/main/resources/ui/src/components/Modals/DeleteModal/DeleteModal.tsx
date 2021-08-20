import React from 'react';
import { Button } from '../../buttons/Button/Button';
type Props = {
  cancelText: string;
  confirmText: string;
  bodyText: string;
  header: string;
  onConfirm: () => void;
  onCancel: () => void;
};
const DeleteModal = ({
  cancelText,
  confirmText,
  header,
  onConfirm,
  onCancel,
  bodyText,
}: Props) => {
  return (
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-w-auto">
        <div className="tw-modal-header">
          <p className="tw-modal-title">{header}</p>
        </div>
        <div className="tw-modal-body">
          <p>{bodyText}</p>
        </div>
        <div className="tw-modal-footer tw-justify-end">
          <Button
            className="tw-mr-2"
            size="regular"
            variant="outlined"
            onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            className="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default DeleteModal;
