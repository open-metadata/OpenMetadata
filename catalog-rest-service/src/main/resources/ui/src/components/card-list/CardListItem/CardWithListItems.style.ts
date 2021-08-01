export const cardStyle = {
  base: 'tw-flex tw-flex-col tw-rounded-md tw-border tw-mb-4',
  default: 'tw-border-primary-light',
  active: 'tw-border-primary-dark',
  header: {
    base: 'tw-flex tw-px-5 tw-py-3 tw-cursor-pointer tw-justify-between tw-items-center',
    default: 'tw-bg-primary-light',
    active: 'tw-bg-primary-dark tw-rounded-t-md tw-text-white',
    title: 'tw-text-base tw-mb-0',
    description: 'tw-font-normal tw-pr-2',
  },
  body: {
    base: 'tw-py-5 tw-px-10',
    default: 'tw-hidden',
    active: 'tw-block',
    content: {
      withBorder: 'tw-py-3 tw-border-b',
      withoutBorder: 'tw-py-1',
    },
  },
};
