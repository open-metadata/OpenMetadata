import { JSON_TAB_SIZE } from '../../constants/constants';
import { getJSONFromString } from '../../utils/StringsUtils';

export const getSchemaEditorValue = (
  value: string,
  autoFormat = true
): string => {
  if (typeof value === 'string') {
    if (autoFormat) {
      const parsedJson = getJSONFromString(value);

      return parsedJson
        ? JSON.stringify(parsedJson, null, JSON_TAB_SIZE)
        : value;
    } else {
      return value;
    }
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, JSON_TAB_SIZE);
  }

  return '';
};
