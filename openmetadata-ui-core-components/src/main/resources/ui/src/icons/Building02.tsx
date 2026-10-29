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

export const Building02: FC<Props> = ({
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
      d="M12.5 17.5V13c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.091-.412-.091-.878-.091H8.834c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364C7.5 12.3 7.5 12.533 7.5 13v4.5m-5-11.667a2.5 2.5 0 0 0 5 0 2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0 5 0M5.167 17.5h9.667c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.181-.357.181-.823.181-1.757V5.167c0-.933 0-1.4-.182-1.757a1.67 1.67 0 0 0-.728-.728c-.357-.182-.823-.182-1.757-.182H5.167c-.933 0-1.4 0-1.757.182a1.67 1.67 0 0 0-.728.728c-.182.357-.182.823-.182 1.757v9.667c0 .933 0 1.4.182 1.757a1.67 1.67 0 0 0 .728.728c.357.181.823.181 1.757.181"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Building02.displayName = 'Building02';
