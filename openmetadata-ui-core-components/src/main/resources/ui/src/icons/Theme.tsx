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

export const Theme: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M18 10a8 8 0 1 0-8 8c.673 0 1.6.093 1.6-.8 0-.487-.253-.863-.505-1.236-.368-.547-.733-1.088-.295-1.964.533-1.067 1.422-1.067 2.785-1.067.682 0 1.482 0 2.415-.133 1.68-.24 2-1.273 2-2.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M9.2 7.204a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0M14.798 8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0m-8.699 4.4h-.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Theme.displayName = 'Theme';
