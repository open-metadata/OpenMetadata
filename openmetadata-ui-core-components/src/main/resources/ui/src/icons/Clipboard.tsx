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

export const Clipboard: FC<Props> = ({
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
      d="M13.333 3.333c.775 0 1.163 0 1.48.085a2.5 2.5 0 0 1 1.768 1.768c.086.318.086.706.086 1.481v7.667c0 1.4 0 2.1-.272 2.635a2.5 2.5 0 0 1-1.092 1.093c-.536.271-1.236.271-2.636.271H7.333c-1.4 0-2.1 0-2.635-.272a2.5 2.5 0 0 1-1.092-1.092c-.273-.536-.273-1.236-.273-2.636V6.667c0-.775 0-1.162.085-1.48a2.5 2.5 0 0 1 1.768-1.768c.318-.086.706-.086 1.481-.086M8 5h4c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.091-.178.091-.412.091-.878V3c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.091-.411-.091-.878-.091H8c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.091.178-.091.411-.091.878v.667c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364C7.3 5 7.533 5 8 5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Clipboard.displayName = 'Clipboard';
