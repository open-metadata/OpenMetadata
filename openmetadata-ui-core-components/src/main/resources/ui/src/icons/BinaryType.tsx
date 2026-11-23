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

export const BinaryType: FC<Props> = ({
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
      d="M4.583 12.79h-.75a.835.835 0 0 0-.833.833v2.543a.835.835 0 0 0 .834.834h.75a.835.835 0 0 0 .833-.834v-2.543a.834.834 0 0 0-.834-.833Zm.382 3.376a.383.383 0 0 1-.382.382h-.75a.383.383 0 0 1-.381-.382v-2.543a.38.38 0 0 1 .382-.382h.75a.38.38 0 0 1 .381.382zm.891-8.045v3.758a.226.226 0 0 1-.451 0V8.121a.226.226 0 1 1 .451 0Zm-2.63-.226a.226.226 0 0 1 .226.226v3.758a.226.226 0 0 1-.452 0V8.121a.226.226 0 0 1 .226-.226Zm4.104-4.67v3.76a.226.226 0 1 1-.452 0v-3.76a.226.226 0 1 1 .452 0ZM3.834 7.21h.75a.835.835 0 0 0 .833-.833V3.834A.835.835 0 0 0 4.583 3h-.75A.835.835 0 0 0 3 3.834v2.543a.835.835 0 0 0 .834.833Zm-.382-3.376a.38.38 0 0 1 .382-.382h.75a.383.383 0 0 1 .381.382v2.543a.38.38 0 0 1-.382.382h-.75a.38.38 0 0 1-.381-.382zm13.096 3.15V3.227a.226.226 0 1 1 .452 0v3.759a.226.226 0 1 1-.452 0Zm-.382.91h-.75a.834.834 0 0 0-.833.834v2.544a.834.834 0 0 0 .834.833h.75a.834.834 0 0 0 .833-.834V8.729a.835.835 0 0 0-.834-.833Zm.382 3.377a.383.383 0 0 1-.382.383h-.75a.383.383 0 0 1-.381-.383V8.729a.38.38 0 0 1 .382-.382h.75a.383.383 0 0 1 .381.382zM17 13.016v3.76a.226.226 0 0 1-.452 0v-3.76a.226.226 0 0 1 .452 0Zm-2.405 0v3.76a.226.226 0 0 1-.451 0v-3.76a.226.226 0 0 1 .451 0Zm-3.238-.225h-.75a.835.835 0 0 0-.833.833v2.543a.835.835 0 0 0 .834.834h.75a.834.834 0 0 0 .833-.834v-2.543a.835.835 0 0 0-.834-.833Zm.382 3.376a.38.38 0 0 1-.382.382h-.75a.383.383 0 0 1-.381-.382v-2.543a.38.38 0 0 1 .382-.382h.75a.383.383 0 0 1 .381.382zm3.347-9.79V3.835A.835.835 0 0 0 14.253 3h-.75a.835.835 0 0 0-.833.834v2.543a.835.835 0 0 0 .833.833h.75a.835.835 0 0 0 .833-.833Zm-1.965 0V3.835a.38.38 0 0 1 .382-.382h.75a.38.38 0 0 1 .382.382v2.543a.38.38 0 0 1-.382.382h-.75a.383.383 0 0 1-.382-.382Zm-1.913 0V3.835A.835.835 0 0 0 10.375 3h-.75a.835.835 0 0 0-.833.834v2.543a.835.835 0 0 0 .833.833h.75a.835.835 0 0 0 .833-.833Zm-1.965 0V3.835a.383.383 0 0 1 .382-.382h.75a.38.38 0 0 1 .382.382v2.543a.38.38 0 0 1-.382.382h-.75a.38.38 0 0 1-.382-.382Zm-.982 1.745v3.758a.226.226 0 0 1-.452 0V8.121a.226.226 0 1 1 .452 0Zm3.536-.226h-.75a.834.834 0 0 0-.834.833v2.544a.835.835 0 0 0 .834.833h.75a.834.834 0 0 0 .833-.834V8.729a.835.835 0 0 0-.833-.833Zm.382 3.377a.38.38 0 0 1-.382.382h-.75a.383.383 0 0 1-.382-.383V8.729a.383.383 0 0 1 .382-.382h.75a.383.383 0 0 1 .382.382zM7.82 13.015v3.76a.226.226 0 0 1-.451 0v-3.76a.226.226 0 0 1 .451 0Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.4}
    />
  </svg>
);
BinaryType.displayName = 'BinaryType';
