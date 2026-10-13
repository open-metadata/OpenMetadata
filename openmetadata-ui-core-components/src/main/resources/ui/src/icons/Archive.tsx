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

export const Archive: FC<Props> = ({
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
      d="M3.6 6.798a2 2 0 0 1-.312-.028A1.6 1.6 0 0 1 2.03 5.513C2 5.358 2 5.173 2 4.8s0-.558.03-.712a1.6 1.6 0 0 1 1.258-1.257C3.442 2.8 3.628 2.8 4 2.8h12c.372 0 .558 0 .712.03a1.6 1.6 0 0 1 1.258 1.26c.031.154.031.34.031.712s0 .557-.03.712a1.6 1.6 0 0 1-1.258 1.257c-.085.017-.18.025-.312.028m-8 4.003h3.2m-8-4h12.8v6.56c0 1.344 0 2.016-.262 2.53a2.4 2.4 0 0 1-1.048 1.048c-.514.262-1.186.262-2.53.262H7.44c-1.344 0-2.016 0-2.53-.262a2.4 2.4 0 0 1-1.048-1.049c-.262-.513-.262-1.185-.262-2.53z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Archive.displayName = 'Archive';
