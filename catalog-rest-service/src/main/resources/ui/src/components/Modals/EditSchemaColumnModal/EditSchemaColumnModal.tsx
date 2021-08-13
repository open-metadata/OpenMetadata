/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import React, { FunctionComponent, useState } from 'react';
import { Button } from '../../buttons/Button/Button';

type Props = {
  header: string;
  description: string;
  onSave: (text: string) => void;
  // onSuggest: (text: string) => void;
  onCancel: () => void;
};

export const EditSchemaColumnModal: FunctionComponent<Props> = ({
  header,
  description,
  onSave,
  onCancel,
}: Props) => {
  const [descriptionText, setDescriptionText] = useState<string>(description);

  const handleDescriptionChange = (
    e: React.ChangeEvent<{ value: string }>
  ): void => {
    setDescriptionText(e.target.value);
  };

  return (
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container">
        <div className="tw-modal-header">
          <p className="tw-modal-title">{header}</p>
          <svg
            className="tw-w-6 tw-h-6 tw-cursor-pointer"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            onClick={onCancel}>
            <path
              d="M6 18L18 6M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="tw-modal-body">
          <p className="tw-mb-2 tw-font-medium tw-text-gray-700">Description</p>
          <textarea
            className="tw-p-5 tw-bg-white tw-border tw-border-main tw-rounded tw-shadow-sm tw-h-32 focus:tw-outline-none"
            data-testid="column-description"
            name="column-description"
            placeholder="Type message..."
            onChange={handleDescriptionChange}>
            {descriptionText}
          </textarea>
        </div>
        <div className="tw-modal-footer tw-justify-end">
          <Button
            className="tw-mr-2"
            size="regular"
            variant="outlined"
            onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="regular"
            theme="primary"
            variant="contained"
            onClick={() => onSave(descriptionText)}>
            Save
          </Button>
        </div>
      </div>
    </dialog>
  );
};
