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

export const Billing: FC<Props> = ({
  size = 20,
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
      d="M3.6 15.317V6.843c0-2.283 0-3.424.703-4.134C5.005 2 6.137 2 8.4 2h3.2c2.262 0 3.394 0 4.097.71.703.709.703 1.85.703 4.133v8.474c0 1.209 0 1.814-.37 2.052-.604.389-1.538-.427-2.007-.723-.388-.245-.582-.367-.797-.374-.233-.008-.43.11-.85.374l-1.528.964c-.413.26-.619.39-.848.39-.23 0-.436-.13-.848-.39l-1.53-.964c-.387-.245-.581-.367-.796-.374-.233-.008-.43.11-.85.374-.47.296-1.403 1.112-2.007.723-.37-.238-.37-.843-.37-2.052m9.6-10.117h-6.4m1.6 3.198h-1.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.999 8.298c-.663 0-1.2.47-1.2 1.05s.537 1.05 1.2 1.05 1.2.47 1.2 1.05-.537 1.05-1.2 1.05m0-4.2c.522 0 .967.292 1.131.7m-1.13-.7v-.7m0 4.9c-.523 0-.967-.292-1.132-.7m1.132.7v.7"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Billing.displayName = 'Billing';
