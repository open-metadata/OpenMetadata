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

export const ShoppingBag01: FC<Props> = ({
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
      d="M4.6 2.2 3.3 3.933c-.257.343-.386.515-.383.658a.42.42 0 0 0 .16.32C3.19 5 3.404 5 3.833 5h12.333c.429 0 .644 0 .757-.088a.42.42 0 0 0 .16-.32c.003-.143-.126-.315-.383-.658l-1.3-1.733m-10.8 0c.147-.196.22-.293.313-.364a.8.8 0 0 1 .275-.137c.112-.033.233-.033.479-.033h8.667c.244 0 .367 0 .479.032a.8.8 0 0 1 .275.138c.093.071.166.168.313.364m-10.8 0L3.033 4.289c-.197.263-.297.396-.367.541a1.7 1.7 0 0 0-.136.406c-.03.158-.03.323-.03.653v9.778c0 .933 0 1.4.182 1.757a1.67 1.67 0 0 0 .728.728c.357.181.823.181 1.757.181h9.667c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.181-.356.181-.823.181-1.756V5.889c0-.33 0-.495-.031-.653a1.7 1.7 0 0 0-.136-.406c-.07-.145-.169-.277-.367-.542L15.4 2.2m-2.067 6.133a3.333 3.333 0 1 1-6.667 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ShoppingBag01.displayName = 'ShoppingBag01';
