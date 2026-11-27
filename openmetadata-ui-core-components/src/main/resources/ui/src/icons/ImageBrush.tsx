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

export const ImageBrush: FC<Props> = ({
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
      d="M6.056 14.28H5.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C2 12.76 2 12.2 2 11.08V6.817c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874c.428-.218.988-.218 2.108-.218h5.275c.98 0 1.47 0 1.853.168a2 2 0 0 1 1.03 1.03c.168.384.168.873.168 1.853"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={5.312}
      cy={7.304}
      r={1.117}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m4.037 11.418 1.106-.939c.052-.043.078-.065.102-.083a1 1 0 0 1 1.09-.072c.026.015.054.034.11.07.062.04.092.059.12.075a1 1 0 0 0 1.142-.118c.025-.021.05-.047.102-.098l1.857-1.832c.385-.38.578-.57.785-.644a1 1 0 0 1 .843.078c.19.11.345.333.654.777m-.661 4.15C12.822 11 16.3 7.514 17.771 7.44c.91-.087-.903 3.143-5.2 6.676m-3.518 2.198c.352-1.247.13-.634.25-2.07.064-.212.193-.872 1-1.2a1.464 1.464 0 0 1 1.76.456c.512.555.57 1.243 0 2.03s-2.263.982-3.01.784"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ImageBrush.displayName = 'ImageBrush';
