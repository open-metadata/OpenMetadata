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

export const RecentChats: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M5.258 9.383A6.404 6.404 0 0 1 11.591 2a6.404 6.404 0 0 1 5.995 8.668v.002a2 2 0 0 0-.096.274.7.7 0 0 0-.018.155c-.002.058.006.123.022.251l.32 2.617c.035.283.052.425.005.528a.4.4 0 0 1-.204.2c-.104.045-.244.025-.524-.017h-.001l-2.535-.373a2 2 0 0 0-.259-.03c-.06.001-.1.006-.159.018s-.134.04-.284.097h-.001a6.4 6.4 0 0 1-3.24.336M5.259 9.383A4.2 4.2 0 0 1 6.483 9.2c2.36 0 4.272 1.97 4.272 4.4S8.84 18 6.482 18c-.488 0-.956-.084-1.392-.239l-.004-.001a3 3 0 0 0-.3-.098.7.7 0 0 0-.15-.016c-.058 0-.123.009-.253.027L2 18l.487-2.21c.031-.144.047-.217.051-.28a.7.7 0 0 0-.008-.17 3 3 0 0 0-.1-.343 4.5 4.5 0 0 1-.22-1.397c0-1.992 1.285-3.675 3.048-4.217"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
RecentChats.displayName = 'RecentChats';
