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

export const Bank: FC<Props> = ({
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
      d="M4.167 7.5v6.667M7.917 7.5v6.667M12.084 7.5v6.667M15.833 7.5v6.667M2.5 15.5v.667c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.091.412.091.878.091h12.333c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.092-.178.092-.412.092-.878V15.5c0-.467 0-.7-.091-.878a.83.83 0 0 0-.364-.364c-.178-.091-.412-.091-.878-.091H3.833c-.467 0-.7 0-.878.091a.83.83 0 0 0-.364.364c-.091.178-.091.411-.091.878M9.711 2.564 3.544 3.935c-.372.083-.558.124-.698.224a.83.83 0 0 0-.278.348c-.068.157-.068.348-.068.729v.931c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.091.412.091.878.091h12.333c.467 0 .7 0 .878-.091a.83.83 0 0 0 .364-.364c.092-.178.092-.412.092-.878v-.931c0-.381 0-.572-.067-.729a.83.83 0 0 0-.279-.347c-.138-.1-.325-.142-.697-.225l-6.167-1.37a2 2 0 0 0-.217-.041 1 1 0 0 0-.145 0 2 2 0 0 0-.217.042Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Bank.displayName = 'Bank';
