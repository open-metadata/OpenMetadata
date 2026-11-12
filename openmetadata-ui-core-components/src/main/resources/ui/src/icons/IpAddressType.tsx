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

export const IpAddressType: FC<Props> = ({
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
    xmlnsXlink="http://www.w3.org/1999/xlink"
    {...props}>
    <path
      d="M8.107 4.813h.938V9.5h-.938zm2.813 2.812h.469a1.407 1.407 0 0 0 0-2.813H9.982V9.5h.938zm0-1.875h.469a.47.47 0 0 1 0 .938h-.47z"
      fill="currentColor"
    />
    <use fill="currentColor" xlinkHref="#a" />
    <mask
      fill="currentColor"
      height={18}
      id="b"
      maskUnits="userSpaceOnUse"
      width={12}
      x={3.844}
      y={1}>
      <path d="M3.844 1h12v18h-12z" fill="#fff" />
      <use xlinkHref="#a" />
    </mask>
    <path
      d="M10.469 15.268v-1.352l3.14-3.077a5.12 5.12 0 0 0 1.547-3.683A5.16 5.16 0 0 0 10 2a5.16 5.16 0 0 0-5.156 5.156c0 1.397.55 2.706 1.548 3.683l3.14 3.077v1.352a1.41 1.41 0 0 0-.858.857h-3.83v.938h3.83c.194.545.715.937 1.326.937s1.132-.392 1.326-.937h3.83v-.938h-3.83a1.41 1.41 0 0 0-.857-.857ZM5.78 7.156A4.224 4.224 0 0 1 10 2.938a4.224 4.224 0 0 1 4.219 4.218c0 1.143-.45 2.214-1.267 3.014L10 13.063 7.048 10.17A4.2 4.2 0 0 1 5.78 7.156ZM10 17.063a.47.47 0 1 1 .001-.94.47.47 0 0 1-.001.94Z"
      mask="url(#b)"
      stroke="currentColor"
      strokeWidth={0.2}
    />
    <defs>
      <path
        d="M10.469 15.268v-1.352l3.14-3.077a5.12 5.12 0 0 0 1.547-3.683A5.16 5.16 0 0 0 10 2a5.16 5.16 0 0 0-5.156 5.156c0 1.397.55 2.706 1.548 3.683l3.14 3.077v1.352a1.41 1.41 0 0 0-.858.857h-3.83v.938h3.83c.194.545.715.937 1.326.937s1.132-.392 1.326-.937h3.83v-.938h-3.83a1.41 1.41 0 0 0-.857-.857M5.78 7.156A4.224 4.224 0 0 1 10 2.938a4.224 4.224 0 0 1 4.219 4.218c0 1.143-.45 2.214-1.267 3.014L10 13.063 7.048 10.17A4.2 4.2 0 0 1 5.78 7.156M10 17.063a.47.47 0 1 1 .001-.94.47.47 0 0 1-.001.94"
        id="a"
      />
    </defs>
  </svg>
);
IpAddressType.displayName = 'IpAddressType';
