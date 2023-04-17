/*
 *  Copyright 2023 Collate.
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
import { InfoCircleOutlined } from '@ant-design/icons';
import { Popover, PopoverProps } from 'antd';
import React from 'react';
import './InfoPopover.less';

const InfoPopover = ({ content, className }: PopoverProps) => {
  return (
    <Popover
      align={{ offset: [0, -10] }}
      className={className}
      content={content}
      overlayStyle={{ maxWidth: 350 }}
      placement="bottom"
      showArrow={false}
      trigger="hover">
      <InfoCircleOutlined className="tw-mx-1 info-popover-icon" />
    </Popover>
  );
};

export default InfoPopover;
