export enum NavigatorUserAgent {
  MAC = 'Mac',
  WINDOWS = 'Win',
  LINUX = 'Linux',
  ANDROID = 'Android',
  IOS = 'like Mac',
}

export class NavigatorHelper {
  static isMacOs() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.MAC) != -1;
  }

  static isWindows() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.WINDOWS) != -1;
  }

  static isLinuxOs() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.LINUX) != -1;
  }

  static isAndroidOs() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.ANDROID) != -1;
  }

  static isIos() {
    return navigator.userAgent.indexOf(NavigatorUserAgent.IOS) != -1;
  }
}
