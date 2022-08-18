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
import { Status, WebhookType } from '../../../generated/entity/events/webhook';
import { stringToHTML } from '../../../utils/StringsUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import WebhookDataCardBody from './WebhookDataCardBody';

type Props = {
  name: string;
  description?: string;
  endpoint: string;
  status?: Status;
  type?: WebhookType;
  onClick?: (name: string) => void;
};

const WebhookDataCard: FunctionComponent<Props> = ({
  name,
  description,
  endpoint,
  type,
  status = Status.Disabled,
  onClick,
}: Props) => {
  const handleLinkClick = () => {
    onClick?.(name);
  };

  return (
    <div
      className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md"
      data-testid="webhook-data-card">
      <div>
        <div className="tw-flex tw-items-center">
          <SVGIcons
            alt="webhook"
            icon={type === WebhookType.Slack ? Icons.SLACK_GREY : Icons.WEBHOOK}
            width="16"
          />
          <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-1">
            <button
              className="tw-font-medium tw-text-primary hover:tw-underline tw-cursor-pointer"
              data-testid="webhook-link"
              onClick={handleLinkClick}>
              {stringToHTML(name)}
            </button>
          </h6>
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
