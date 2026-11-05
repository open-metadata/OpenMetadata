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

export const Tag: FC<Props> = ({
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
      d="M7.055 7.055h.008M2.5 4.93v3.398c0 .371 0 .557.042.731q.056.234.182.44c.094.153.225.284.488.547l5.822 5.822c.902.902 1.353 1.353 1.873 1.521.457.15.95.15 1.407 0 .52-.168.971-.62 1.873-1.521l1.68-1.68c.902-.902 1.353-1.353 1.521-1.873.15-.457.15-.95 0-1.407-.168-.52-.62-.971-1.521-1.873l-5.823-5.822c-.262-.263-.393-.394-.547-.488a1.5 1.5 0 0 0-.439-.182c-.174-.042-.36-.042-.731-.042H4.929c-.85 0-1.275 0-1.6.166a1.5 1.5 0 0 0-.663.663c-.166.325-.166.75-.166 1.6m4.935 2.126a.38.38 0 1 1-.76 0 .38.38 0 0 1 .76 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Tag.displayName = 'Tag';
