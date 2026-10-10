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

export const SortDescending: FC<Props> = ({
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
      d="M5.98 4.238v13.045M2.499 6.846S5.06 3.367 5.978 3.367s3.479 3.479 3.479 3.479"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.366 6.193a.652.652 0 0 0 0 1.305zm2.61 1.305a.652.652 0 0 0 0-1.305zm-4.102.892a.652.652 0 0 0 1.245.39l-.623-.195zm4.349.39a.652.652 0 0 0 1.245-.39l-.623.195zm-2.857-1.934v.652h2.61V6.193h-2.61zm-.356.094-.622-.194-.514 1.644.622.195.623.194.514-1.644zm3.835 1.645.623-.195-.514-1.644-.623.194-.623.195.515 1.644zM13.01 6.94l.623.195c.35-1.119.591-1.966.828-2.554.119-.295.214-.465.285-.553.065-.082.038-.009-.075-.009V2.715c-.434 0-.743.247-.942.496-.194.24-.346.555-.478.882-.263.654-.532 1.594-.863 2.653zm3.321 0 .623-.194c-.331-1.06-.6-2-.863-2.653-.132-.327-.284-.641-.478-.882-.2-.249-.509-.496-.942-.496v1.304c-.114 0-.14-.073-.075.009.07.088.166.258.284.553.237.588.479 1.435.828 2.554z"
      fill="currentColor"
    />
    <path
      d="M12.938 12.066h2.057c.803 0 1.205 0 1.322.25.117.251-.14.56-.654 1.177l-1.972 2.365c-.514.617-.771.925-.654 1.176.118.25.52.25 1.323.25h2.057"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SortDescending.displayName = 'SortDescending';
