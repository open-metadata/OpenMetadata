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

import React from 'react';
import NoDataFoundPlaceHolder from '../../../assets/img/no-data-placeholder.png';

type Props = {
  children?: React.ReactNode;
};

const ErrorPlaceHolder = ({ children }: Props) => (
  <>
    <div
      className="tw-flex tw-flex-col tw-mt-24 tw-place-items-center"
      data-testid="error">
      {' '}
      <img
        data-testid="no-data-image"
        src={NoDataFoundPlaceHolder}
        width="200"
      />
    </div>
    {children && (
      <div className="tw-flex tw-flex-col tw-items-center tw-mt-10 tw-text-base tw-font-normal">
        {children}
      </div>
    )}
  </>
);

export default ErrorPlaceHolder;
