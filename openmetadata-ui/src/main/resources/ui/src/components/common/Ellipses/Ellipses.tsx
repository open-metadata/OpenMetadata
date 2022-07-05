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

import { Typography } from 'antd';
import { EllipsisConfig } from 'antd/lib/typography/Base';
import classNames from 'classnames';
import React, { CSSProperties, FC } from 'react';

interface Props extends EllipsisConfig {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

const Ellipses: FC<Props> = ({ children, className, style, ...props }) => {
  return (
    <Typography.Paragraph
      className={classNames('ant-typography-ellipsis-custom', className)}
      ellipsis={props}
      style={style}>
      {children}
    </Typography.Paragraph>
  );
};

export default Ellipses;
