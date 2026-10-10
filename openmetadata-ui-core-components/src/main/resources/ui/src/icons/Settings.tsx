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

export const Settings: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="m17.403 6.107-.395-.685c-.298-.519-.448-.778-.702-.881s-.541-.022-1.116.141l-.976.275a1.6 1.6 0 0 1-1.087-.135l-.27-.156a1.6 1.6 0 0 1-.63-.774l-.267-.798c-.176-.528-.263-.792-.473-.943S11.002 2 10.446 2h-.892c-.555 0-.833 0-1.042.151s-.297.415-.473.943l-.267.798a1.6 1.6 0 0 1-.63.774l-.27.156c-.335.172-.72.22-1.087.135l-.976-.275c-.574-.163-.862-.244-1.116-.141s-.403.362-.702.88l-.395.686c-.28.486-.42.729-.392.987.027.259.214.467.589.884l.825.922c.201.255.344.7.344 1.1s-.143.845-.344 1.1l-.825.922c-.375.417-.562.625-.59.884-.027.258.113.501.393.987l.395.685c.299.519.448.778.702.881s.542.022 1.116-.141l.976-.275a1.6 1.6 0 0 1 1.087.135l.27.156a1.6 1.6 0 0 1 .63.774l.267.798c.176.528.264.792.473.943.21.151.487.151 1.042.151h.892c.556 0 .833 0 1.043-.151s.296-.415.472-.943l.267-.798c.123-.319.343-.59.63-.774l.27-.156c.335-.172.72-.22 1.087-.135l.976.275c.575.163.862.244 1.116.141s.404-.362.702-.88l.395-.686c.28-.486.42-.729.393-.987-.027-.259-.215-.467-.59-.884l-.824-.922c-.202-.255-.345-.7-.345-1.1s.143-.845.345-1.1l.825-.922c.374-.417.562-.625.589-.884.027-.258-.113-.501-.393-.987"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.764 9.995a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Settings.displayName = 'Settings';
