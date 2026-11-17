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

export const StackSearch: FC<Props> = ({
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
      d="m5.895 3.888-1.177.544C2.906 5.27 2 5.69 2 6.376s.906 1.107 2.718 1.944l1.177.544c1.14.527 1.71.79 2.317.79.606 0 1.177-.263 2.317-.79l1.177-.544c1.812-.837 2.718-1.256 2.718-1.944s-.906-1.106-2.718-1.944l-1.177-.544c-1.14-.527-1.71-.79-2.317-.79-.606 0-1.177.263-2.317.79M2.146 9.375A.74.74 0 0 0 2 9.812c0 .678.906 1.091 2.718 1.917l1.177.536c1.14.52 1.71.78 2.317.78.187 0 .37-.025.569-.075m1.749 3.154c-1.141.52-1.712.779-2.318.779s-1.177-.26-2.317-.78l-1.177-.536C2.906 14.762 2 14.35 2 13.671c0-.27.143-.497.43-.726M18 16.542l-1.804-1.804m0 0a2.775 2.775 0 1 0-3.8-4.044 2.775 2.775 0 0 0 3.8 4.044"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
StackSearch.displayName = 'StackSearch';
