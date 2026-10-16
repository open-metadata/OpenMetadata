/*
 *  Copyright 2025 Collate.
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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const Auth0: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M4.02 8.784a6.45 6.45 0 0 0 5.322-5.322l.221-1.329a.404.404 0 0 0-.43-.465c-2.08.16-4.04.851-5.124 1.294a1.4 1.4 0 0 0-.87 1.296v4.2c0 .247.221.435.465.394zm6.638-5.322a6.45 6.45 0 0 0 5.322 5.322l.416.068a.398.398 0 0 0 .465-.394v-4.2c0-.568-.345-1.079-.87-1.296-1.082-.446-3.044-1.134-5.124-1.294a.4.4 0 0 0-.429.464zm5.324 6.641a6.45 6.45 0 0 0-5.322 5.322l-.272 2.593c-.024.234.234.4.43.27l.005-.003c1.713-1.156 5.621-4.181 6.007-7.959a.284.284 0 0 0-.328-.308l-.517.085zm-6.641 5.321a6.45 6.45 0 0 0-5.322-5.322l-.557-.093a.255.255 0 0 0-.294.275c.367 3.8 4.33 6.844 6.056 7.999.18.12.416-.024.394-.239l-.274-2.623z"
      fill="#717680"
    />
  </svg>
);
Auth0.displayName = 'Auth0';
