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

export const Laptop01: FC<Props> = ({
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
      d="M2.5 13.333V6c0-.933 0-1.4.182-1.757a1.67 1.67 0 0 1 .728-.728c.357-.182.823-.182 1.757-.182h9.667c.933 0 1.4 0 1.757.182a1.67 1.67 0 0 1 .728.728c.181.357.181.824.181 1.757v7.333h-4.447c-.204 0-.306 0-.402.023a.8.8 0 0 0-.242.1c-.083.051-.156.123-.3.267l-.052.053c-.144.144-.217.217-.3.268a.8.8 0 0 1-.242.1c-.096.023-.197.023-.402.023H8.885c-.204 0-.306 0-.402-.023a.8.8 0 0 1-.242-.1c-.083-.051-.156-.123-.3-.267l-.052-.053c-.144-.144-.217-.217-.3-.268a.8.8 0 0 0-.242-.1c-.094-.023-.195-.023-.399-.023zm0 0a.833.833 0 0 0-.833.833v.278c0 .517 0 .775.057.988a1.67 1.67 0 0 0 1.178 1.178c.213.057.471.057.988.057h12.222c.517 0 .775 0 .988-.057a1.67 1.67 0 0 0 1.178-1.178c.057-.213.057-.471.057-.987 0-.258 0-.387-.028-.493a.83.83 0 0 0-.589-.589c-.108-.03-.237-.03-.495-.03h-.556"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Laptop01.displayName = 'Laptop01';
