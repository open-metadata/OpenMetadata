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

import React from 'react';
import { ReactComponent as CmdButton } from '../../../assets/svg/command-button.svg';
import { ReactComponent as CtrlButton } from '../../../assets/svg/control-button.svg';
import { ReactComponent as KButton } from '../../../assets/svg/k-button.svg';
import { NavigatorHelper } from '../../../utils/NavigatorUtils';

const CmdKIcon = () => {
  return (
    <div className="tw-flex tw-items-center">
      {NavigatorHelper.isMacOs() ? (
        <CmdButton
          style={{
            backgroundColor: 'white',
          }}
        />
      ) : (
        <CtrlButton
          style={{
            backgroundColor: 'white',
          }}
        />
      )}
      <KButton
        style={{
          marginLeft: '4px',
          backgroundColor: 'white',
        }}
      />
    </div>
  );
};

export default CmdKIcon;
