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

import React, { FC, ReactNode } from 'react';

interface PageLayoutProp {
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
}

const PageLayout: FC<PageLayoutProp> = ({
  leftPanel,
  children,
  rightPanel,
}: PageLayoutProp) => {
  return (
    <div className="tw-grid tw-grid-flow-col tw-gap-x-3 tw-px-4 tw-overflow-y-auto">
      {leftPanel && (
        <div
          className="tw-col-span-1 tw-w-64 tw-overflow-y-auto tw-px-2 tw-py-1"
          id="left-panel">
          {leftPanel}
        </div>
      )}
      <div
        className="tw-col-span-3  tw-overflow-y-auto tw-px-2 tw-py-1"
        id="center">
        {children}
      </div>
      {rightPanel && (
        <div
          className="tw-col-span-1 tw-w-64  tw-overflow-y-auto tw-px-2 tw-py-1"
          id="right-panel">
          {rightPanel}
        </div>
      )}
    </div>
  );
};

export default PageLayout;
