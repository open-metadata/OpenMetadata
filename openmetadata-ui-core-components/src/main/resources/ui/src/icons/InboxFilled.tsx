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

export const InboxFilled: FC<Props> = ({
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
      d="M18 12.4v-1.55l-.505-.764h-2.84l-1.66 1.181-5.939.224-1.883-1.405H2.262L2 10.849v1.55c0 1.26 0 1.89.262 2.372.23.423.597.768 1.048.983C3.824 16 4.496 16 5.84 16h8.32c1.344 0 2.016 0 2.53-.245a2.33 2.33 0 0 0 1.048-.983C18 14.29 18 13.66 18 12.399"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="M12.427 4H7.573c-.861 0-1.292 0-1.672.123a2.4 2.4 0 0 0-.897.52c-.287.263-.48.625-.865 1.347L2.405 9.24c-.15.283-.226.425-.28.574a2 2 0 0 0-.102.405C2 10.374 2 10.533 2 10.85v1.55c0 1.26 0 1.89.262 2.371.23.424.597.768 1.048.984C3.824 16 4.496 16 5.84 16h8.32c1.344 0 2.016 0 2.53-.245a2.33 2.33 0 0 0 1.048-.984c.262-.48.262-1.11.262-2.371v-1.55c0-.317 0-.476-.023-.63a2 2 0 0 0-.102-.406c-.054-.149-.13-.29-.28-.574L15.86 5.99c-.385-.722-.578-1.084-.865-1.347a2.4 2.4 0 0 0-.897-.52C13.72 4 13.29 4 12.427 4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2.4 10h2.706c.548 0 1.05.29 1.294.75.246.46.747.75 1.295.75h4.611c.548 0 1.05-.29 1.294-.75.245-.46.747-.75 1.295-.75H17.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
InboxFilled.displayName = 'InboxFilled';
