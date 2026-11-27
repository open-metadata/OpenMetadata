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

export const IntakeForms: FC<Props> = ({
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
      d="M3.6 10.796v1.236c0 2.598 0 3.896.708 4.776q.216.268.483.483C5.671 18 6.968 18 9.564 18c.565 0 .847 0 1.105-.091q.081-.03.158-.066c.247-.118.447-.317.845-.716h.001l3.79-3.792c.462-.463.693-.694.815-.988s.122-.622.122-1.276V8.395c0-3.018 0-4.528-.938-5.465-.745-.746-1.85-.899-3.789-.93M10.8 17.6v-.4c0-2.264 0-3.396.703-4.1s1.834-.703 4.097-.703h.4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.8 8.218c1.413 0 2.56-1.172 2.56-2.618S8.213 2.982 6.8 2.982m0 5.236c-1.414 0-2.56-1.172-2.56-2.618S5.386 2.982 6.8 2.982m0 5.236V9.2m0-6.218V2M4.473 4.172 3.6 3.636M10 7.564l-.873-.536m0-2.856.872-.536M3.6 7.564l.873-.536"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
IntakeForms.displayName = 'IntakeForms';
