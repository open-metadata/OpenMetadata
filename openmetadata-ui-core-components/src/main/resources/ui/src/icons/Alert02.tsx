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

export const Alert02: FC<Props> = ({
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
      d="M10 6.8V10m0 3.2h.008M2 7.218v5.564c0 .195 0 .293.022.385a.8.8 0 0 0 .096.232c.05.08.119.15.257.288l3.938 3.938c.138.139.208.208.288.257a.8.8 0 0 0 .232.096c.092.022.19.022.385.022h5.564c.195 0 .293 0 .385-.022a.8.8 0 0 0 .232-.096c.08-.05.15-.119.288-.257l3.938-3.938c.139-.138.208-.208.257-.288a.8.8 0 0 0 .096-.232c.022-.092.022-.19.022-.385V7.218c0-.195 0-.293-.022-.385a.8.8 0 0 0-.096-.232 1.8 1.8 0 0 0-.257-.288l-3.938-3.938c-.138-.138-.208-.208-.288-.257a.8.8 0 0 0-.232-.096C13.075 2 12.977 2 12.782 2H7.218c-.195 0-.293 0-.385.022a.8.8 0 0 0-.232.096c-.08.05-.15.119-.288.257L2.375 6.313c-.138.138-.208.208-.257.288a.8.8 0 0 0-.096.232C2 6.925 2 7.023 2 7.218"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Alert02.displayName = 'Alert02';
