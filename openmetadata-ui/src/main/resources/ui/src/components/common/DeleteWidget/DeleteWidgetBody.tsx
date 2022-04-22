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

import React from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../../constants/constants';
import NonAdminAction from '../non-admin-action/NonAdminAction';

type DeleteWidgetBodyProps = {
  header: string;
  description: string;
  buttonText: string;
  isOwner?: boolean;
  hasPermission: boolean;
  onClick: () => void;
};

const DeleteWidgetBody = ({
  header,
  description,
  buttonText,
  isOwner,
  hasPermission,
  onClick,
}: DeleteWidgetBodyProps) => {
  return (
    <div className="tw-flex tw-justify-between tw-px-5 tw-py-3">
      <div className="tw-w-10/12" data-testid="danger-zone-text">
        <p
          className="tw-text-sm tw-mb-1 tw-font-medium"
          data-testid="danger-zone-text-title">
          {header}
        </p>
        <p
          className="tw-text-grey-muted tw-text-xs"
          data-testid="danger-zone-text-para">
          {description}
        </p>
      </div>
      <NonAdminAction
        className="tw-self-center"
        html={<p>{TITLE_FOR_NON_ADMIN_ACTION}</p>}
        isOwner={isOwner}
        position="left">
        <button
          className="tw-px-3 tw-py-1 tw-rounded tw-h-auto tw-self-center tw-font-medium tw-delete-outline-button "
          data-testid="delete-button"
          disabled={!hasPermission}
          onClick={onClick}>
          {buttonText}
        </button>
      </NonAdminAction>
    </div>
  );
};

export default DeleteWidgetBody;
