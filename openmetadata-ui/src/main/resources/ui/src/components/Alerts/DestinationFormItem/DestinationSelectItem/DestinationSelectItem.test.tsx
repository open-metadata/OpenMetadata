/*
 *  Copyright 2024 Collate.
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

import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Form, FormInstance } from 'antd';
import { isString } from 'lodash';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../../generated/events/eventSubscription';
import DestinationSelectItem from './DestinationSelectItem';
import { DestinationSelectItemProps } from './DestinationSelectItem.interface';

const MOCK_DESTINATION_SELECT_ITEM_PROPS: DestinationSelectItemProps = {
  selectorKey: 0,
  id: 0,
  remove: jest.fn(),
  isDestinationStatusLoading: false,
};

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'testFqn' })),
}));

jest.mock('antd', () => {
  const antd = jest.requireActual('antd');

  return {
    ...antd,
    Form: {
      ...antd.Form,
      useFormInstance: jest.fn().mockImplementation(() => ({
        setFieldValue: jest.fn(),
        getFieldValue: jest
          .fn()
          .mockImplementation((val: string | string[]) =>
            isString(val) ? [{ category: 'External' }] : ''
          ),
      })),
    },
  };
});

jest.mock('../../../../utils/CommonUtils', () => ({
  Transi18next: jest.fn().mockImplementation(({ i18nKey }) => {
    return <span>{i18nKey}</span>;
  }),
}));

describe('DestinationSelectItem component', () => {
  it('should show internal tab by default in the dropdown', async () => {
    render(
      <Form initialValues={{ destinations: [{}] }}>
        <DestinationSelectItem {...MOCK_DESTINATION_SELECT_ITEM_PROPS} />
      </Form>
    );

    const id = MOCK_DESTINATION_SELECT_ITEM_PROPS.id;
    const selectorKey = MOCK_DESTINATION_SELECT_ITEM_PROPS.selectorKey;

    expect(screen.getByTestId(`destination-${id}`)).toBeInTheDocument();

    const categorySelect = await findByRole(
      screen.getByTestId(`destination-category-select-${id}`),
      'combobox'
    );

    // Handle click and dropdown rendering
    await act(async () => {
      fireEvent.focus(categorySelect);
      fireEvent.keyDown(categorySelect, {
        key: 'ArrowDown',
        code: 'ArrowDown',
      });
    });

    // Wait for the dropdown to be rendered in the portal
    await waitFor(async () => {
      expect(
        await screen.findByTestId(
          `destination-category-dropdown-${selectorKey}`
        )
      ).toBeInTheDocument();
    });

    expect(
      await screen.findByTestId('Admins-internal-option')
    ).toHaveTextContent('Admins');
    expect(
      await screen.findByTestId('Followers-internal-option')
    ).toHaveTextContent('Followers');
    expect(
      await screen.findByTestId('Owners-internal-option')
    ).toHaveTextContent('Owners');
    expect(
      await screen.findByTestId('Teams-internal-option')
    ).toHaveTextContent('Teams');
    expect(
      await screen.findByTestId('Users-internal-option')
    ).toHaveTextContent('Users');
  });

  it('should show external tab by default when selected destination type is external', async () => {
    jest.spyOn(Form, 'useFormInstance').mockImplementationOnce(() => ({
      ...Form.useFormInstance(),
      setFieldValue: jest.fn(),
      getFieldValue: jest
        .fn()
        .mockImplementation((val: string | string[]) =>
          isString(val)
            ? [{ category: 'External', destinationType: 'Teams' }]
            : ''
        ),
    }));

    const id = MOCK_DESTINATION_SELECT_ITEM_PROPS.id;
    const selectorKey = MOCK_DESTINATION_SELECT_ITEM_PROPS.selectorKey;

    await act(async () => {
      render(
        <Form initialValues={{ destinations: [{}] }}>
          <DestinationSelectItem {...MOCK_DESTINATION_SELECT_ITEM_PROPS} />
        </Form>
      );
    });

    const categorySelect = await findByRole(
      screen.getByTestId(`destination-category-select-${id}`),
      'combobox'
    );

    // Handle initial focus and state updates
    await act(async () => {
      fireEvent.focus(categorySelect);
      fireEvent.keyDown(categorySelect, {
        key: 'ArrowDown',
        code: 'ArrowDown',
      });
    });

    // Wait for the dropdown to be rendered in the portal
    await waitFor(() => {
      expect(
        screen.getByTestId(`destination-category-dropdown-${selectorKey}`)
      ).toBeInTheDocument();
    });

    expect(
      await screen.findByTestId('Email-external-option')
    ).toHaveTextContent('Email');
    expect(
      await screen.findByTestId('G Chat-external-option')
    ).toHaveTextContent('G Chat');
    expect(
      await screen.findByTestId('Webhook-external-option')
    ).toHaveTextContent('Webhook');
    expect(
      await screen.findByTestId('Ms Teams-external-option')
    ).toHaveTextContent('Ms Teams');
    expect(
      await screen.findByTestId('Slack-external-option')
    ).toHaveTextContent('Slack');
  });

  it('should call remove method with correct id on click of remove field button', async () => {
    const id = MOCK_DESTINATION_SELECT_ITEM_PROPS.id;

    await act(async () => {
      render(
        <Form initialValues={{ destinations: [{}] }}>
          <DestinationSelectItem {...MOCK_DESTINATION_SELECT_ITEM_PROPS} />
        </Form>
      );
    });

    const removeFieldButton = screen.getByTestId(`remove-destination-${id}`);

    await act(async () => {
      fireEvent.click(removeFieldButton);
    });

    expect(MOCK_DESTINATION_SELECT_ITEM_PROPS.remove).toHaveBeenCalledWith(id);
  });

  describe('Warning message display logic', () => {
    it('should show destination-owner-selection-warning when destinationType is Owners and subscriptionType is not Email', async () => {
      const mockFormInstance: Partial<FormInstance> = {
        setFieldValue: jest.fn(),
        getFieldValue: jest
          .fn()
          .mockImplementation((val: string | string[]) => {
            if (isString(val)) {
              return [{ category: 'External' }];
            }
            if (
              Array.isArray(val) &&
              val.length === 3 &&
              val[0] === 'destinations' &&
              Number(val[1]) === 0
            ) {
              if (val[2] === 'destinationType') {
                return SubscriptionCategory.Owners;
              }
              if (val[2] === 'type') {
                return SubscriptionType.ActivityFeed;
              }
            }
            if (
              Array.isArray(val) &&
              val.length === 2 &&
              val[0] === 'destinations' &&
              Number(val[1]) === 0
            ) {
              return {
                destinationType: SubscriptionCategory.Owners,
                type: SubscriptionType.ActivityFeed,
              };
            }

            return '';
          }),
      };

      jest
        .spyOn(Form, 'useFormInstance')
        .mockImplementation(() => mockFormInstance as FormInstance);
      const useWatchMock = jest
        .spyOn(Form, 'useWatch')
        .mockImplementation((name: string | string[]) => {
          if (
            Array.isArray(name) &&
            name[0] === 'destinations' &&
            Number(name[1]) === 0
          ) {
            return {
              destinationType: SubscriptionCategory.Owners,
              type: SubscriptionType.ActivityFeed,
            };
          }
          if (name === 'destinations') {
            return [
              {
                destinationType: SubscriptionCategory.Owners,
                type: SubscriptionType.ActivityFeed,
              },
            ];
          }
          if (Array.isArray(name) && name[0] === 'resources') {
            return ['test-resource'];
          }

          return undefined;
        });

      await act(async () => {
        render(
          <Form
            initialValues={{
              destinations: [
                {
                  destinationType: SubscriptionCategory.Owners,
                  type: SubscriptionType.ActivityFeed,
                },
              ],
            }}>
            <DestinationSelectItem {...MOCK_DESTINATION_SELECT_ITEM_PROPS} />
          </Form>
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText('message.destination-owner-selection-warning')
        ).toBeInTheDocument();
      });
      useWatchMock.mockRestore();
    });

    it('should show destination-selection-warning when destinationType is Owners but subscriptionType is Email', async () => {
      const mockFormInstance: Partial<FormInstance> = {
        setFieldValue: jest.fn(),
        getFieldValue: jest
          .fn()
          .mockImplementation((val: string | string[]) => {
            if (isString(val)) {
              return [{ category: 'External' }];
            }
            if (
              Array.isArray(val) &&
              val.length === 3 &&
              val[0] === 'destinations' &&
              Number(val[1]) === 0
            ) {
              if (val[2] === 'destinationType') {
                return SubscriptionCategory.Owners;
              }
              if (val[2] === 'type') {
                return SubscriptionType.Email;
              }
            }
            if (
              Array.isArray(val) &&
              val.length === 2 &&
              val[0] === 'destinations' &&
              Number(val[1]) === 0
            ) {
              return {
                destinationType: SubscriptionCategory.Owners,
                type: SubscriptionType.Email,
              };
            }

            return '';
          }),
      };

      jest
        .spyOn(Form, 'useFormInstance')
        .mockImplementation(() => mockFormInstance as FormInstance);
      const useWatchMock = jest
        .spyOn(Form, 'useWatch')
        .mockImplementation((name: string | string[]) => {
          if (
            Array.isArray(name) &&
            name[0] === 'destinations' &&
            Number(name[1]) === 0
          ) {
            return {
              destinationType: SubscriptionCategory.Owners,
              type: SubscriptionType.Email,
            };
          }
          if (name === 'destinations') {
            return [
              {
                destinationType: SubscriptionCategory.Owners,
                type: SubscriptionType.Email,
              },
            ];
          }
          if (Array.isArray(name) && name[0] === 'resources') {
            return ['test-resource'];
          }

          return undefined;
        });

      await act(async () => {
        render(
          <Form
            initialValues={{
              destinations: [
                {
                  destinationType: SubscriptionCategory.Owners,
                  type: SubscriptionType.Email,
                },
              ],
            }}>
            <DestinationSelectItem {...MOCK_DESTINATION_SELECT_ITEM_PROPS} />
          </Form>
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText('message.destination-selection-warning')
        ).toBeInTheDocument();
      });
      useWatchMock.mockRestore();
    });

    it('should show destination-selection-warning when destinationType is not Owners', async () => {
      const mockFormInstance: Partial<FormInstance> = {
        setFieldValue: jest.fn(),
        getFieldValue: jest
          .fn()
          .mockImplementation((val: string | string[]) => {
            if (isString(val)) {
              return [{ category: 'External' }];
            }
            if (
              Array.isArray(val) &&
              val.length === 3 &&
              val[0] === 'destinations' &&
              Number(val[1]) === 0
            ) {
              if (val[2] === 'destinationType') {
                return SubscriptionCategory.Admins;
              }
              if (val[2] === 'type') {
                return SubscriptionType.ActivityFeed;
              }
            }
            if (
              Array.isArray(val) &&
              val.length === 2 &&
              val[0] === 'destinations' &&
              Number(val[1]) === 0
            ) {
              return {
                destinationType: SubscriptionCategory.Admins,
                type: SubscriptionType.ActivityFeed,
              };
            }

            return '';
          }),
      };

      jest
        .spyOn(Form, 'useFormInstance')
        .mockImplementation(() => mockFormInstance as FormInstance);
      const useWatchMock = jest
        .spyOn(Form, 'useWatch')
        .mockImplementation((name: string | string[]) => {
          if (
            Array.isArray(name) &&
            name[0] === 'destinations' &&
            Number(name[1]) === 0
          ) {
            return {
              destinationType: SubscriptionCategory.Admins,
              type: SubscriptionType.ActivityFeed,
            };
          }
          if (name === 'destinations') {
            return [
              {
                destinationType: SubscriptionCategory.Admins,
                type: SubscriptionType.ActivityFeed,
              },
            ];
          }
          if (Array.isArray(name) && name[0] === 'resources') {
            return ['test-resource'];
          }

          return undefined;
        });

      await act(async () => {
        render(
          <Form
            initialValues={{
              destinations: [
                {
                  destinationType: SubscriptionCategory.Admins,
                  type: SubscriptionType.ActivityFeed,
                },
              ],
            }}>
            <DestinationSelectItem {...MOCK_DESTINATION_SELECT_ITEM_PROPS} />
          </Form>
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText('message.destination-selection-warning')
        ).toBeInTheDocument();
      });
      useWatchMock.mockRestore();
    });

    it('should not show warning message when destinationType is not an internal destination', async () => {
      const mockFormInstance: Partial<FormInstance> = {
        setFieldValue: jest.fn(),
        getFieldValue: jest
          .fn()
          .mockImplementation((val: string | string[]) => {
            if (isString(val)) {
              return [{ category: 'External' }];
            }
            if (
              Array.isArray(val) &&
              val.length === 3 &&
              val[0] === 'destinations' &&
              Number(val[1]) === 0
            ) {
              if (val[2] === 'destinationType') {
                return SubscriptionType.Webhook;
              }
              if (val[2] === 'type') {
                return SubscriptionType.Webhook;
              }
            }
            if (
              Array.isArray(val) &&
              val.length === 2 &&
              val[0] === 'destinations' &&
              Number(val[1]) === 0
            ) {
              return {
                destinationType: SubscriptionType.Webhook,
                type: SubscriptionType.Webhook,
              };
            }

            return '';
          }),
      };

      jest
        .spyOn(Form, 'useFormInstance')
        .mockImplementation(() => mockFormInstance as FormInstance);
      const useWatchMock = jest
        .spyOn(Form, 'useWatch')
        .mockImplementation((name: string | string[]) => {
          if (
            Array.isArray(name) &&
            name[0] === 'destinations' &&
            Number(name[1]) === 0
          ) {
            return {
              destinationType: SubscriptionType.Webhook,
              type: SubscriptionType.Webhook,
            };
          }
          if (name === 'destinations') {
            return [
              {
                destinationType: SubscriptionType.Webhook,
                type: SubscriptionType.Webhook,
              },
            ];
          }
          if (Array.isArray(name) && name[0] === 'resources') {
            return ['test-resource'];
          }

          return undefined;
        });

      await act(async () => {
        render(
          <Form
            initialValues={{
              destinations: [
                {
                  destinationType: SubscriptionType.Webhook,
                  type: SubscriptionType.Webhook,
                },
              ],
            }}>
            <DestinationSelectItem {...MOCK_DESTINATION_SELECT_ITEM_PROPS} />
          </Form>
        );
      });

      await waitFor(() => {
        expect(
          screen.queryByText('message.destination-owner-selection-warning')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('message.destination-selection-warning')
        ).not.toBeInTheDocument();
      });
      useWatchMock.mockRestore();
    });
  });
});
