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

export const Data: FC<Props> = ({
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
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path d="M21.2 22c.28 0 .42 0 .527-.055a.5.5 0 0 0 .218-.218C22 21.62 22 21.48 22 21.2V10.8c0-.28 0-.42-.055-.527a.5.5 0 0 0-.218-.218C21.62 10 21.48 10 21.2 10h-2.4c-.28 0-.42 0-.527.055a.5.5 0 0 0-.218.218C18 10.38 18 10.52 18 10.8v2.4c0 .28 0 .42-.055.527a.5.5 0 0 1-.218.218C17.62 14 17.48 14 17.2 14h-2.4c-.28 0-.42 0-.527.055a.5.5 0 0 0-.218.218C14 14.38 14 14.52 14 14.8v2.4c0 .28 0 .42-.055.527a.5.5 0 0 1-.218.218C13.62 18 13.48 18 13.2 18h-2.4c-.28 0-.42 0-.527.055a.5.5 0 0 0-.218.218C10 18.38 10 18.52 10 18.8v2.4c0 .28 0 .42.055.527a.5.5 0 0 0 .218.218c.107.055.247.055.527.055zM10 6.8c0-.28 0-.42.055-.527a.5.5 0 0 1 .218-.218C10.38 6 10.52 6 10.8 6h2.4c.28 0 .42 0 .527.054a.5.5 0 0 1 .218.219C14 6.38 14 6.52 14 6.8v2.4c0 .28 0 .42-.055.527a.5.5 0 0 1-.218.218C13.62 10 13.48 10 13.2 10h-2.4c-.28 0-.42 0-.527-.055a.5.5 0 0 1-.218-.218C10 9.62 10 9.48 10 9.2zm-7 6c0-.28 0-.42.054-.527a.5.5 0 0 1 .219-.218C3.38 12 3.52 12 3.8 12h2.4c.28 0 .42 0 .527.055a.5.5 0 0 1 .218.218C7 12.38 7 12.52 7 12.8v2.4c0 .28 0 .42-.054.527a.5.5 0 0 1-.219.218C6.62 16 6.48 16 6.2 16H3.8c-.28 0-.42 0-.527-.055a.5.5 0 0 1-.219-.218C3 15.62 3 15.48 3 15.2zm-1-10c0-.28 0-.42.054-.527a.5.5 0 0 1 .219-.219C2.38 2 2.52 2 2.8 2h2.4c.28 0 .42 0 .527.054a.5.5 0 0 1 .218.219C6 2.38 6 2.52 6 2.8v2.4c0 .28 0 .42-.054.527a.5.5 0 0 1-.219.218C5.62 6 5.48 6 5.2 6H2.8c-.28 0-.42 0-.527-.054a.5.5 0 0 1-.219-.219C2 5.62 2 5.48 2 5.2z" />
  </svg>
);
Data.displayName = 'Data';
