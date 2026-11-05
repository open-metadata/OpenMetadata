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

export const Tag01: FC<Props> = ({
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
      d="M6.667 6.667h.008M1.667 4.333v3.729c0 .408 0 .611.046.803q.063.256.2.483c.103.168.247.312.535.6l6.391 6.391c.99.99 1.485 1.485 2.056 1.67a2.5 2.5 0 0 0 1.545 0c.571-.185 1.067-.68 2.056-1.67l1.843-1.843c.99-.99 1.485-1.485 1.67-2.056a2.5 2.5 0 0 0 0-1.545c-.185-.571-.68-1.067-1.67-2.056L9.948 2.448c-.288-.288-.433-.433-.6-.535a1.7 1.7 0 0 0-.482-.2c-.192-.046-.395-.046-.803-.046h-3.73c-.933 0-1.4 0-1.757.182a1.67 1.67 0 0 0-.728.728c-.181.356-.181.823-.181 1.756m5.416 2.334a.417.417 0 1 1-.833 0 .417.417 0 0 1 .833 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Tag01.displayName = 'Tag01';
