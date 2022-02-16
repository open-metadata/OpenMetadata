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

import React, { FunctionComponent } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../../constants/constants';
import { Status } from '../../../generated/entity/events/webhook';
import { stringToHTML } from '../../../utils/StringsUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import NonAdminAction from '../non-admin-action/NonAdminAction';
import WebhookDataCardBody from './WebhookDataCardBody';

type Props = {
  name: string;
  description?: string;
  endpoint: string;
  status?: Status;
  onDelete: () => void;
  onEdit: () => void;
};

const WebhookDataCard: FunctionComponent<Props> = ({
  name,
  description,
  endpoint,
  status = Status.NotStarted,
  onDelete,
  onEdit,
}: Props) => {
  return (
    <div
      className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md"
      data-testid="webhook-data-card">
      <div>
        <div className="tw-flex tw-items-center">
          <h6 className="tw-flex tw-items-center tw-m-0 tw-heading">
            <span className="tw-text-grey-body tw-font-medium">
              {stringToHTML(name)}
            </span>
          </h6>
          <div className="tw-flex tw-flex-auto tw-justify-end">
            <NonAdminAction position="top" title={TITLE_FOR_NON_ADMIN_ACTION}>
              <button
                className="focus:tw-outline-none tw-ml-2"
                data-testid={`edit-webhook-${name}`}
                onClick={onEdit}>
                <SVGIcons
                  alt="edit"
                  icon={Icons.EDIT}
                  title="Edit"
                  width="12px"
                />
              </button>
              <button
                className="focus:tw-outline-none tw-ml-2"
                data-testid={`delete-webhook-${name}`}
                onClick={onDelete}>
                <SVGIcons
                  alt="delete"
                  icon={Icons.DELETE}
                  title="Delete"
                  width="12px"
                />
              </button>
            </NonAdminAction>
          </div>
        </div>
      </div>
      <div className="tw-pt-3">
        <WebhookDataCardBody
          description={description || ''}
          endpoint={endpoint}
          status={status}
        />
      </div>
    </div>
  );
};

export default WebhookDataCard;
