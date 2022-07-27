/*
 *  Copyright 2022 Collate
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
import {
  ControlOutlined,
  MacCommandOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Typography } from 'antd';
import React from 'react';
import { NavigatorHelper } from '../../../utils/NavigatorUtils';

const CmdKIcon = () => {
  return (
    <div className="tw-flex tw-items-center">
      {NavigatorHelper.isMacOs() ? (
        <MacCommandOutlined
          className="tw-m-0"
          style={{
            fontSize: '14px',
            color: '#95989f',
          }}
        />
      ) : (
        <ControlOutlined
          className="tw-m-0"
          style={{
            fontSize: '14px',
            color: '#95989f',
          }}
        />
      )}

      <PlusOutlined
        className="tw-mx-0 tw-my"
        style={{
          fontSize: '10px',
          color: '#95989f',
        }}
      />
      <Typography.Text
        className="tw-text-sm tw-m-0"
        style={{
          color: '#95989f',
        }}>
        K
      </Typography.Text>
    </div>
  );
};

export default CmdKIcon;
