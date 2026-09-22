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

export const ThumbsDown: FC<Props> = ({
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
    <path d="M17 2v11m5-3.2V5.2c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C20.48 2 19.92 2 18.8 2H8.118c-1.461 0-2.192 0-2.782.267A3 3 0 0 0 4.06 3.361c-.354.542-.465 1.265-.687 2.71l-.523 3.4c-.293 1.904-.44 2.857-.157 3.598a3 3 0 0 0 1.32 1.539C4.704 15 5.667 15 7.595 15H8.4c.56 0 .84 0 1.054.109a1 1 0 0 1 .437.437c.11.214.11.494.11 1.054v2.934A2.466 2.466 0 0 0 12.465 22a.82.82 0 0 0 .751-.488l3.36-7.562c.154-.344.23-.516.35-.642a1 1 0 0 1 .384-.249c.164-.059.352-.059.729-.059h.76c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C22 11.48 22 10.92 22 9.8" />
  </svg>
);
ThumbsDown.displayName = 'ThumbsDown';
