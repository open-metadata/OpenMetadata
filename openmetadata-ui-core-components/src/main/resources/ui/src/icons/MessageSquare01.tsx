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

export const MessageSquare01: FC<Props> = ({
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
      d="M2.5 6.5c0-1.4 0-2.1.273-2.635a2.5 2.5 0 0 1 1.093-1.092C4.4 2.5 5.1 2.5 6.5 2.5h7c1.4 0 2.1 0 2.635.273a2.5 2.5 0 0 1 1.093 1.093C17.5 4.4 17.5 5.1 17.5 6.5V11c0 1.4 0 2.1-.272 2.635a2.5 2.5 0 0 1-1.092 1.093C15.6 15 14.9 15 13.5 15H8.07c-.52 0-.78 0-1.029.051a2.5 2.5 0 0 0-.635.223c-.225.117-.428.278-.835.603l-1.988 1.59c-.347.278-.52.417-.667.417a.42.42 0 0 1-.325-.157c-.091-.114-.091-.337-.091-.78z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MessageSquare01.displayName = 'MessageSquare01';
