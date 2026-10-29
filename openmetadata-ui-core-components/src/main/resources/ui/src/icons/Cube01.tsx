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

export const Cube01: FC<Props> = ({
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
      d="M17.083 6.065 10 10m0 0L2.917 6.065M10 10v7.917m7.5-4.534V6.618c0-.286 0-.428-.042-.556a.8.8 0 0 0-.179-.303c-.091-.099-.215-.168-.465-.307l-6.167-3.426c-.237-.132-.354-.197-.479-.223a.8.8 0 0 0-.336 0c-.125.025-.243.092-.48.223L3.185 5.451c-.25.139-.375.208-.465.308a.8.8 0 0 0-.179.303c-.041.128-.041.271-.041.556v6.764c0 .285 0 .428.042.555a.8.8 0 0 0 .179.303c.091.099.215.168.465.307l6.167 3.426c.237.132.354.198.48.223a.8.8 0 0 0 .335 0c.125-.026.243-.092.48-.223l6.167-3.425c.25-.139.375-.208.465-.307a.8.8 0 0 0 .179-.303c.042-.127.042-.27.042-.555Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Cube01.displayName = 'Cube01';
