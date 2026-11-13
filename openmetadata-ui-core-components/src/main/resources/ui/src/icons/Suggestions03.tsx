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

export const Suggestions03: FC<Props> = ({
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
      d="m10.896 14.678.2-.041c.264-.054.264-.43 0-.484l-.2-.04a1.28 1.28 0 0 1-1-1l-.04-.2c-.054-.264-.431-.264-.484 0l-.041.2a1.28 1.28 0 0 1-1 1l-.2.04c-.263.053-.263.43 0 .484l.2.04a1.28 1.28 0 0 1 1 1l.04.2c.054.264.431.264.485 0l.04-.2a1.28 1.28 0 0 1 1-1m3.517 1.253a.24.24 0 0 1-.241-.242v-.654a.241.241 0 0 1 .483 0v.654a.24.24 0 0 1-.242.242m0 1.761a.24.24 0 0 1-.241-.241v-.654a.241.241 0 0 1 .483 0v.654a.24.24 0 0 1-.242.241m1.207-1.208h-.654a.242.242 0 0 1 0-.483h.654a.241.241 0 1 1 0 .483m-1.76 0h-.654a.241.241 0 1 1 0-.483h.654a.241.241 0 0 1 0 .483M3.448 12.887a.24.24 0 0 1-.241-.242v-.654a.241.241 0 0 1 .483 0v.654a.24.24 0 0 1-.242.242m0 1.761a.24.24 0 0 1-.241-.241v-.654a.241.241 0 1 1 .483 0v.654a.24.24 0 0 1-.242.241m1.207-1.208h-.654a.241.241 0 1 1 0-.483h.654a.241.241 0 0 1 0 .483m-1.76 0h-.654a.241.241 0 1 1 0-.483h.654a.241.241 0 0 1 0 .483m11.55-9.99a.24.24 0 0 1-.242-.242v-.654a.241.241 0 0 1 .483 0v.654a.24.24 0 0 1-.241.241m0 1.761a.24.24 0 0 1-.242-.24v-.654a.241.241 0 0 1 .483 0v.653a.24.24 0 0 1-.241.242m1.206-1.209h-.654a.241.241 0 1 1 0-.482h.654a.241.241 0 0 1 0 .482m-1.76 0h-.653a.241.241 0 0 1 0-.482h.653a.241.241 0 1 1 0 .482M10.2 6.885l.956-.195c.452-.091.452-.737 0-.829l-.957-.194a2.4 2.4 0 0 1-1.871-1.871l-.194-.957c-.092-.452-.738-.452-.83 0l-.193.957a2.4 2.4 0 0 1-1.872 1.871l-.957.194c-.452.092-.452.738 0 .83l.957.194c.943.19 1.68.928 1.872 1.871l.194.957c.091.452.737.452.829 0l.194-.957a2.4 2.4 0 0 1 1.871-1.871m6.807 3.33.735-.15c.347-.07.347-.565 0-.636l-.735-.149a1.84 1.84 0 0 1-1.438-1.437l-.149-.735c-.07-.347-.566-.347-.636 0l-.15.735a1.84 1.84 0 0 1-1.436 1.437l-.736.15c-.347.07-.347.566 0 .636l.736.149a1.84 1.84 0 0 1 1.437 1.437l.149.735c.07.347.566.347.636 0l.15-.735a1.84 1.84 0 0 1 1.437-1.437"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);
Suggestions03.displayName = 'Suggestions03';
