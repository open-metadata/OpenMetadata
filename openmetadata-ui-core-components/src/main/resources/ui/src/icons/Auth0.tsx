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
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M4.824 10.541a7.745 7.745 0 0 0 6.387-6.387l.264-1.594A.484.484 0 0 0 10.96 2c-2.496.193-4.848 1.022-6.15 1.553A1.68 1.68 0 0 0 3.768 5.11v5.04c0 .296.264.521.558.473zm7.966-6.387a7.74 7.74 0 0 0 6.387 6.387l.498.082a.478.478 0 0 0 .558-.473V5.11c0-.682-.414-1.295-1.044-1.556C17.89 3.019 15.536 2.194 13.04 2a.48.48 0 0 0-.516.558zm6.389 7.97a7.745 7.745 0 0 0-6.387 6.386l-.326 3.112c-.03.28.28.48.515.323l.007-.003c2.055-1.387 6.745-5.017 7.209-9.551a.342.342 0 0 0-.395-.37l-.62.102zm-7.97 6.385a7.745 7.745 0 0 0-6.386-6.387l-.669-.111a.305.305 0 0 0-.353.33c.441 4.56 5.197 8.213 7.268 9.599.216.144.5-.03.473-.287l-.33-3.147z"
      fill="#717680"
    />
  </svg>
);
Auth0.displayName = 'Auth0';
