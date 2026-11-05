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

export const Lightbulb05: FC<Props> = ({
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
      d="M10 1.667V2.5M2.5 10h-.833m2.917-5.417-.5-.5m11.333.5.5-.5M18.333 10H17.5m-9.167 1.25h3.333m-1.667 0v4.167m2.917-1.355a5 5 0 1 0-5.833 0v1.605c0 .933 0 1.4.182 1.757a1.67 1.67 0 0 0 .728.728c.357.181.824.181 1.757.181h.5c.933 0 1.4 0 1.757-.182a1.67 1.67 0 0 0 .728-.728c.182-.357.182-.823.182-1.757z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Lightbulb05.displayName = 'Lightbulb05';
