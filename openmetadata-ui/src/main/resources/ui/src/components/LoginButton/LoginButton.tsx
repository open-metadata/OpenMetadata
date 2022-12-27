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
import SVGIcons from '../../utils/SvgUtils';

interface LoginButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ssoBrandName: string;
  ssoBrandLogo?: string;
}

const LoginButton = ({
  ssoBrandName,
  ssoBrandLogo,
  ...props
}: LoginButtonProps) => {
  const svgIcon = ssoBrandLogo ? (
    <SVGIcons alt={`${ssoBrandName} Logo`} icon={ssoBrandLogo} width="30" />
  ) : null;

  return (
    <button className="tw-signin-button tw-mx-auto" {...props}>
      {svgIcon}
      <span className="tw-ml-3 tw-font-medium tw-text-grey-muted tw-text-xl">
        Sign in with {ssoBrandName}
      </span>
    </button>
  );
};

export default LoginButton;
