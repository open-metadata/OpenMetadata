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
import React, { FC, HTMLAttributes } from 'react';
import ReactDOM from 'react-dom';
import SchemaEditor from '../../schema-editor/SchemaEditor';

interface Prop extends HTMLAttributes<HTMLDivElement> {
  onClose: () => void;
  // eslint-disable-next-line
  data: any;
}

const SchemaModal: FC<Prop> = ({ className, onClose, data }) => {
  return ReactDOM.createPortal(
    <dialog
      className={classNames('tw-modal', className)}
      data-testid="schema-modal">
      <div
        className="tw-modal-backdrop"
        data-testid="schema-modal-backdrop"
        onClick={onClose}
      />
      <div className="tw-modal-container tw-w-8/12">
        <div className={classNames('tw-modal-header')}>
          <p className="tw-modal-title" data-testid="schema-modal-header">
            JSON data
          </p>

          <div className="tw-flex">
            <svg
              className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
              data-testid="schema-modal-close-button"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              onClick={onClose}>
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
        <div
          className={classNames('tw-modal-body')}
          data-testid="schem-modal-body">
          <SchemaEditor
            className="tw-border tw-border-main tw-rounded-md tw-py-4"
            editorClass="custom-entity-schema"
            value={data}
          />
        </div>
      </div>
    </dialog>,
    document.body
  );
};

export default SchemaModal;
