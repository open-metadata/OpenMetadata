/*
 *  Copyright 2022 Collate.
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

export enum NavigatorUserAgent {
  MAC = 'Mac',
  WINDOWS = 'Win',
  LINUX = 'Linux',
  ANDROID = 'Android',
  IOS = 'like Mac',
}

export class NavigatorHelper {
  static isMacOs() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.MAC) !== -1;
  }

  static isWindows() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.WINDOWS) !== -1;
  }

  static isLinuxOs() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.LINUX) !== -1;
  }

  static isAndroidOs() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.ANDROID) !== -1;
  }

  static isIos() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.IOS) !== -1;
  }
}
