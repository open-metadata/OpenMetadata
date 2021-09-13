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

/* eslint-disable max-len */

import React from 'react';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';

type Props = {
  data: {
    highlight?: string;
    bugFix?: string;
    miscellaneous?: string;
  };
};

const ChangeLogs = ({ data }: Props) => {
  return (
    <div>
      {data.highlight && (
        <div className="tw-mb-4">
          <div className="tw-border-b tw-mb-2.5 tw-border-text">
            <p className="tw-text-base tw-font-medium tw-mb-2.5">Highlights</p>
          </div>
          <RichTextEditorPreviewer markdown={data.highlight} />
        </div>
      )}

      {data.bugFix && (
        <div className="tw-mb-4">
          <div className="tw-border-b tw-mb-2.5 tw-border-text">
            <p className="tw-text-base tw-font-medium tw-mb-2.5">Bug fixes</p>
          </div>
          <RichTextEditorPreviewer markdown={data.bugFix} />
        </div>
      )}

      {data.miscellaneous && (
        <div className="tw-mb-4">
          <div className="tw-border-b tw-mb-2.5 tw-border-text">
            <p className="tw-text-base tw-font-medium tw-mb-2.5">
              Miscellaneous
            </p>
          </div>
          <RichTextEditorPreviewer markdown={data.miscellaneous} />
        </div>
      )}
    </div>
  );
};

export default ChangeLogs;
