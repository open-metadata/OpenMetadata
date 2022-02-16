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

import { startCase } from 'lodash';
import React, { FunctionComponent } from 'react';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';

type Props = {
  description: string;
  endpoint: string;
  status: string;
};

const WebhookDataCardBody: FunctionComponent<Props> = ({
  description,
  endpoint,
  status,
}: Props) => {
  return (
    <div data-testid="card-body">
      <div className="tw-mb-3">
        <span>{startCase(status)}</span>
        <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">|</span>
        <span>{endpoint}</span>
      </div>
      <div className="description-text" data-testid="description-text">
        {description.trim() ? (
          <RichTextEditorPreviewer
            enableSeeMoreVariant={false}
            markdown={description}
          />
        ) : (
          <span className="tw-no-description">No description added</span>
        )}
      </div>
    </div>
  );
};

export default WebhookDataCardBody;
