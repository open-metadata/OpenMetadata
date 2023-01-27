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
import React from 'react';
import { HeaderProps } from './PageHeader.interface';
import './PageHeader.style.less';

const PageHeader = ({ data: { header, subHeader } }: HeaderProps) => {
  return (
    <div className="page-header-container">
      <Typography.Title className="heading">{header}</Typography.Title>
      <Typography.Paragraph className="sub-heading">
        {subHeader}
      </Typography.Paragraph>
    </div>
  );
};

export default PageHeader;
