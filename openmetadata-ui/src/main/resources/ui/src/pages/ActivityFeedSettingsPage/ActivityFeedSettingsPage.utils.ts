import { isEmpty, isUndefined } from 'lodash';
import { Filters } from '../../generated/settings/settings';

export const getPayloadFromSelected = (
  selectedOptions: Record<string, string[]>,
  selectedKey?: string
): void | Array<Filters> => {
  const nonUpdatedFields = [] as string[];
  const resultArr = [];

  if (isUndefined(selectedOptions) || isEmpty(selectedKey)) {
    return [] as Filters[];
  }

  if (selectedKey && Object.keys(selectedOptions).includes(selectedKey)) {
    const arr = Object.entries(selectedOptions).map(([, value]) => {
      return (
        value &&
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        value.reduce((valueAcc: any, name: string) => {
          const selected = name.split('-');

          if (selected[1] !== 'entityUpdated') {
            return [
              ...valueAcc,
              {
                eventType: selected[1],
                fields: ['all'],
              },
            ];
          } else {
            nonUpdatedFields.push(selected[2]);

            return valueAcc;
          }
        }, [])
      );
    });
    resultArr.push(...arr[0]);

    if (!isUndefined(nonUpdatedFields) && !isEmpty(nonUpdatedFields)) {
      resultArr.push({
        eventType: 'entityUpdated',
        fields: nonUpdatedFields.filter(
          (name) => !isUndefined(name) || (!isEmpty(name) && name)
        ),
      });
    }

    return resultArr as Filters[];
  }
};
