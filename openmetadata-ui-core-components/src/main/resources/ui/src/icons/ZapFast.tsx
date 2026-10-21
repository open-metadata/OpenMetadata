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

export const ZapFast: FC<Props> = ({
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
      d="M7.5 14.583H2.917M5.417 10h-3.75M7.5 5.417H3.333M14.167 2.5 8.67 10.196c-.243.341-.365.511-.36.653a.42.42 0 0 0 .162.314c.113.087.322.087.741.087h4.12L12.5 17.5l5.497-7.696c.243-.341.365-.511.36-.653a.42.42 0 0 0-.162-.314c-.113-.087-.322-.087-.741-.087h-4.121z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ZapFast.displayName = 'ZapFast';
