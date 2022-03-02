import classNames from 'classnames';
import React, { FC, HTMLAttributes } from 'react';
import AppState from '../../../AppState';
import { CreateThread } from '../../../generated/api/feed/createThread';
import ActivityFeedEditor from '../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';

interface RequestDescriptionModalProp extends HTMLAttributes<HTMLDivElement> {
  header: string;
  threadLink: string;
  defaultValue?: string;
  headerClassName?: string;
  bodyClassName?: string;
  onCancel: () => void;
  createThread: (data: CreateThread) => void;
}

const RequestDescriptionModal: FC<RequestDescriptionModalProp> = ({
  header,
  headerClassName,
  onCancel,
  createThread,
  threadLink,
  defaultValue,
}) => {
  const onPostThread = (value: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;
    const data = {
      message: value,
      from: currentUser,
      about: threadLink,
    };
    createThread(data);
    onCancel();
  };

  return (
    <dialog className="tw-modal" data-testid="modal-container">
      <div className="tw-modal-backdrop" onClick={onCancel} />
      <div className="tw-modal-container tw-w-2/4 tw-pb-0 tw-pt-2">
        <div className={classNames('tw-modal-header tw-pb-2', headerClassName)}>
          <p className="tw-modal-title" data-testid="modal-header">
            {header}
          </p>
          <div className="tw-flex">
            <svg
              className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
              data-testid="closeWhatsNew"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              onClick={onCancel}>
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
              />
            </svg>
          </div>
        </div>
        <div
          className={classNames('tw-modal-body tw-px-0')}
          data-testid="body-text">
          <ActivityFeedEditor
            buttonClass="tw-mr-4 tw-pb-3"
            defaultValue={defaultValue}
            onSave={onPostThread}
          />
        </div>
      </div>
    </dialog>
  );
};

export default RequestDescriptionModal;
