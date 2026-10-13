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

export const Scale01: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M11.6 18H5.84m0 0c-1.344 0-2.016 0-2.53-.262a2.4 2.4 0 0 1-1.048-1.048C2 16.176 2 15.504 2 14.16M5.84 18h.32c1.344 0 2.016 0 2.53-.262a2.4 2.4 0 0 0 1.048-1.048c.262-.514.262-1.186.262-2.53v-.32c0-1.344 0-2.016-.262-2.53a2.4 2.4 0 0 0-1.048-1.048C8.176 10 7.504 10 6.16 10h-.32c-1.344 0-2.016 0-2.53.262a2.4 2.4 0 0 0-1.048 1.048C2 11.824 2 12.496 2 13.84v.32m0 0V8.4M8.4 2h3.2M18 8.4v3.2M14.8 18c.744 0 1.116 0 1.421-.082a2.4 2.4 0 0 0 1.697-1.697C18 15.916 18 15.544 18 14.8m0-9.6c0-.744 0-1.116-.082-1.421a2.4 2.4 0 0 0-1.697-1.697C15.916 2 15.544 2 14.8 2M5.2 2c-.744 0-1.116 0-1.421.082a2.4 2.4 0 0 0-1.697 1.697C2 4.084 2 4.456 2 5.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Scale01.displayName = 'Scale01';
