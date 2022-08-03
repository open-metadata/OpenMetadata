import { KeyboardEvent } from 'react';
import { NavigatorHelper } from './NavigatorUtils';

export enum Keys {
  K = 'k',
  ESC = 'Escape',
}

export const isCommandKeyPress = <T extends HTMLInputElement>(
  event: KeyboardEvent<T>
): boolean => {
  if (NavigatorHelper.isMacOs()) {
    return event.metaKey;
  } else if (!NavigatorHelper.isMacOs()) {
    return event.ctrlKey;
  }

  return false;
};
