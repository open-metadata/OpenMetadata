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

export const ColumnCustomize: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      clipRule="evenodd"
      d="M4.083 2.5h-.017c-.335 0-.612 0-.838.018-.234.02-.449.061-.651.164a1.66 1.66 0 0 0-.729.728 1.7 1.7 0 0 0-.163.652c-.018.225-.018.502-.018.837v8.535c0 .335 0 .612.018.838.019.234.06.449.163.651.16.314.415.569.729.729.202.103.417.144.651.163.226.018.503.018.838.018H7.5a.417.417 0 1 0 0-.833h-.833V7.5H17.5v1.25a.417.417 0 0 0 .833 0V4.899c0-.335 0-.612-.018-.837a1.7 1.7 0 0 0-.163-.652 1.66 1.66 0 0 0-.729-.728 1.7 1.7 0 0 0-.651-.164c-.226-.018-.503-.018-.838-.018zm1.75 5V15h-1.75c-.357 0-.599 0-.787-.016a.9.9 0 0 1-.341-.075.83.83 0 0 1-.364-.364.9.9 0 0 1-.075-.341c-.016-.188-.016-.43-.016-.787V7.5zm0-.833H2.5v-1.75c0-.357 0-.6.016-.787a.9.9 0 0 1 .075-.342.84.84 0 0 1 .364-.364.9.9 0 0 1 .341-.075c.188-.015.43-.016.787-.016h1.75zm.834 0V3.333h9.25c.357 0 .599.001.787.016a.9.9 0 0 1 .341.075c.157.08.284.208.364.364.033.066.06.159.075.342.016.187.016.43.016.787v1.75zm6.25 2.5a.42.42 0 0 0-.373.23l-.684 1.368-1.342-.336a.42.42 0 0 0-.474.218l-.833 1.667a.415.415 0 0 0 .078.481l.955.955-.955.955a.415.415 0 0 0-.078.481l.833 1.667a.42.42 0 0 0 .474.218l1.342-.336.684 1.368c.071.141.215.23.373.23h1.666a.42.42 0 0 0 .373-.23l.684-1.368 1.342.336a.42.42 0 0 0 .474-.218l.833-1.667a.415.415 0 0 0-.078-.481l-.955-.955.955-.955a.415.415 0 0 0 .078-.481l-.833-1.667a.42.42 0 0 0-.474-.218l-1.342.336-.684-1.368a.42.42 0 0 0-.373-.23zm-.461 2.269L13.174 10h1.152l.718 1.436a.415.415 0 0 0 .474.218l1.342-.335.55 1.099-1.038 1.037a.417.417 0 0 0 0 .59l1.038 1.037-.55 1.099-1.342-.335a.415.415 0 0 0-.474.218l-.718 1.436h-1.152l-.718-1.436a.415.415 0 0 0-.474-.218l-1.342.335-.55-1.099 1.038-1.037a.417.417 0 0 0 0-.59l-1.038-1.037.55-1.099 1.342.335a.415.415 0 0 0 .474-.218m.877 2.314a.417.417 0 1 1 .835 0 .417.417 0 0 1-.835 0m.417-1.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);
ColumnCustomize.displayName = 'ColumnCustomize';
