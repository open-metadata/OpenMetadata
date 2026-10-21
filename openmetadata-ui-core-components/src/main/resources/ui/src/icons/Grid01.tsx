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

export const Grid01: FC<Props> = ({
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
      d="M7 2.5H3.833c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.091.178-.091.412-.091.878V7c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.091.412.091.878.091H7c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.091-.178.091-.411.091-.878V3.833c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364C7.7 2.5 7.467 2.5 7 2.5m9.167 0H13c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.091.178-.091.412-.091.878V7c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.091.411.091.878.091h3.167c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364C17.5 7.7 17.5 7.467 17.5 7V3.833c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.091-.412-.091-.878-.091m0 9.167H13c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.091.178-.091.411-.091.878v3.167c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.091.411.091.878.091h3.167c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.091-.178.091-.412.091-.878V13c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.091-.412-.091-.878-.091m-9.167 0H3.833c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364C2.5 12.3 2.5 12.533 2.5 13v3.167c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.091.412.091.878.091H7c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.091-.178.091-.412.091-.878V13c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.091-.411-.091-.878-.091"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Grid01.displayName = 'Grid01';
