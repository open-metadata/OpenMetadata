import { isEmpty, isUndefined } from 'lodash';
import { Filters } from '../../generated/settings/settings';
import { getDiffArray } from '../../utils/CommonUtils';

const entityUpdatedFields = ['description', 'owner', 'tags', 'followers'];

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
                include: ['all'],
                exclude: [],
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
      const selectedUpdatedData = nonUpdatedFields.filter(
        (name) => !isUndefined(name) || (!isEmpty(name) && name)
      );

      resultArr.push({
        eventType: 'entityUpdated',
        include: selectedUpdatedData,
        exclude: getDiffArray(entityUpdatedFields, selectedUpdatedData),
      });
    }

    return resultArr as Filters[];
  }
};
