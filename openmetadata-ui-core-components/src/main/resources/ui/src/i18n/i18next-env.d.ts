/*
 *  Copyright 2026 Collate.
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

// `i18next@21.x` (pinned to match the host app) predates the `TypeOptions` typed-resources
// API that `react-i18next@15.x` reads to decide whether a native element's `children` prop
// may also be a plain object (needed for <Trans/> interpolation). Without a `TypeOptions`
// export, react-i18next's own ambient `declare module 'react' { interface HTMLAttributes<T> }`
// augmentation resolves the flag to `any`, which widens `children` on every native element
// project-wide and breaks components that combine a React Aria prop type (`children:
// ReactNode`) with a native `ComponentPropsWithRef<'tag'>` (e.g. Table, SlideoutMenu,
// SocialButton). Pin the flag to `false` to restore the plain `ReactNode` typing.
//
// The `export {}` marks this file as a module so the augmentation below merges with the
// real `i18next` types instead of being treated as a standalone ambient module replacement.
export {};

declare module 'i18next' {
  interface TypeOptions {
    allowObjectInHTMLChildren: false;
  }
}
