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

export const Tour: FC<Props> = ({
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
      d="M4.526 2.613a8.05 8.05 0 0 1 5.333 2v12.399a8.05 8.05 0 0 0-5.333-2c-1.25 0-1.874 0-2.15-.177a.9.9 0 0 1-.34-.34c-.177-.275-.177-.768-.177-1.752V5.336c0-1.143 0-1.714.44-2.176.438-.463.888-.487 1.786-.535q.22-.012.44-.012m10.667 0a8.05 8.05 0 0 0-5.333 2v12.399a8.05 8.05 0 0 1 5.333-2c1.25 0 1.874 0 2.15-.177a.9.9 0 0 0 .34-.34c.177-.275.177-.768.177-1.752V5.336c0-1.143 0-1.714-.44-2.176-.438-.463-.888-.487-1.786-.535a8 8 0 0 0-.44-.012"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.461 6.075a8.3 8.3 0 0 0-1.6.104m1.6 2.84a8.1 8.1 0 0 0-3.2.54m3.2 2.255a8.1 8.1 0 0 0-3.2.54M4.258 6.075a8.3 8.3 0 0 1 1.6.104m-1.6 2.84q.132-.004.266-.004a8.1 8.1 0 0 1 2.933.545m-3.2 2.254.267-.004a8.1 8.1 0 0 1 2.933.545"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Tour.displayName = 'Tour';
