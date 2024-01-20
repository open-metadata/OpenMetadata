/*
 *  Copyright 2022 Collate.
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

import { Typography } from 'antd';
import React, { ReactElement } from 'react';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';

export const EmptyGraphPlaceholder = ({
  icon,
  message,
}: {
  icon?: ReactElement;
  message?: JSX.Element | string;
}) => {
  return (
    <ErrorPlaceHolder
      icon={icon}
      size={SIZE.MEDIUM}
      type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
      <Typography.Paragraph style={{ marginBottom: '0' }}>
        {message}
      </Typography.Paragraph>
    </ErrorPlaceHolder>
  );
};
