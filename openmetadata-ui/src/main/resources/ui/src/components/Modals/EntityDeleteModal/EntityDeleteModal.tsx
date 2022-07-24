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
import React, {
  ChangeEvent,
  FC,
  HTMLAttributes,
  useCallback,
  useState,
} from 'react';
import { getTitleCase } from '../../../utils/EntityUtils';
import { Button } from '../../buttons/Button/Button';
import Loader from '../../Loader/Loader';

interface Prop extends HTMLAttributes<HTMLDivElement> {
  onConfirm: () => void;
  onCancel: () => void;
  entityName: string;
  entityType: string;
  loadingState: string;
  bodyText?: string;
  softDelete?: boolean;
}

const EntityDeleteModal: FC<Prop> = ({
  loadingState = 'initial',
  className,
  entityName,
  entityType,
  onCancel,
  onConfirm,
  bodyText,
  softDelete = false,
}: Prop) => {
  const [name, setName] = useState('');

  const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const isNameMatching = useCallback(() => {
    return name === 'DELETE';
  }, [name]);

  return (
    <dialog
      className={classNames('tw-modal', className)}
      data-testid="delete-confirmation-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-w-120">
        <div className={classNames('tw-modal-header')}>
          <p className="tw-modal-title tw-break-all" data-testid="modal-header">
            {softDelete ? (
              <span>
                Soft delete <strong>{entityName}</strong>
              </span>
            ) : (
              <span>
                Delete <strong>{entityName}</strong>
              </span>
            )}
          </p>
        </div>
        <div className={classNames('tw-modal-body')} data-testid="body-text">
          <p className="tw-mb-2">
            {bodyText ||
              `Once you delete this ${getTitleCase(
                entityType
              )}, it will be removed permanently`}
          </p>
          <p className="tw-mb-2">
            Type <strong>DELETE</strong> to confirm
          </p>
          <input
            autoComplete="off"
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="confirmation-text-input"
            disabled={loadingState === 'waiting'}
            name="entityName"
            placeholder="DELETE"
            type="text"
            value={name}
            onChange={handleOnChange}
          />
        </div>
        <div className={classNames('tw-modal-footer tw-justify-end')}>
          <Button
            className={classNames('tw-mr-2')}
            data-testid="discard-button"
            disabled={loadingState === 'waiting'}
            size="regular"
            theme="primary"
            variant="text"
            onClick={onCancel}>
            Cancel
          </Button>
          {loadingState === 'waiting' ? (
            <Button
              disabled
              className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
              data-testid="loading-button"
              size="regular"
              theme="primary"
              variant="contained">
              <Loader size="small" type="white" />
            </Button>
          ) : (
            <Button
              data-testid="confirm-button"
              disabled={!isNameMatching()}
              size="regular"
              theme="primary"
              type="submit"
              variant="contained"
              onClick={onConfirm}>
              Confirm
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default EntityDeleteModal;
