export const button = {
  base: `tw-align-bottom tw-inline-flex tw-items-center tw-justify-center tw-cursor-pointer 
    tw-leading-5 tw-transition-colors tw-duration-150 tw-font-medium focus:tw-outline-none`,
  block: 'tw-block tw-w-full',
  size: {
    large: 'tw-px-5 tw-py-3 tw-rounded-lg',
    regular: 'tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm',
    small: 'tw-px-2 tw-py-0.5 tw-rounded-md tw-text-sm',
    'x-small': 'tw-px-2 tw-py-px tw-rounded-md tw-text-xs',
    custom: '',
  },
  contained: {
    default: {
      base: 'tw-text-gray-600 tw-bg-gray-300 tw-border tw-border-transparent',
      active:
        'active:tw-bg-gray-400 hover:tw-bg-gray-400 focus:tw-ring focus:tw-ring-gray-300',
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
    primary: {
      base: 'tw-text-white tw-bg-blue-600 tw-border tw-border-transparent',
      active:
        'active:tw-bg-blue-600 hover:tw-bg-blue-700 focus:tw-ring focus:tw-ring-blue-300',
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
  },
  outlined: {
    default: {
      base: 'tw-text-gray-500 tw-border-gray-300 tw-border dark:tw-text-gray-400 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-border-gray-600 focus:tw-border-gray-600 
      hover:tw-text-gray-600 active:tw-text-gray-600 focus:tw-ring focus:tw-ring-gray-300`,
      disabled: 'tw-opacity-60 tw-cursor-not-allowed',
    },
    primary: {
      base: 'tw-text-blue-600 tw-border-blue-500 tw-border dark:tw-text-blue-300 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-border-blue-600 focus:tw-border-blue-600 
      hover:tw-text-blue-600 active:tw-text-blue-600 focus:tw-ring focus:tw-ring-blue-300`,
    },
  },
  link: {
    default: {
      base: 'tw-text-gray-500 dark:tw-text-gray-400 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-underline focus:tw-underline 
        hover:tw-text-gray-600 active:tw-text-gray-600`,
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
    primary: {
      base: 'tw-text-blue-600 dark:tw-text-blue-300 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-underline focus:tw-underline 
        hover:tw-text-blue-700 active:tw-text-blue-600`,
    },
  },
  text: {
    default: {
      base: 'tw-text-gray-500 dark:tw-text-gray-400 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-text-gray-600 active:tw-text-gray-600`,
      disabled: 'tw-opacity-50 tw-cursor-not-allowed',
    },
    primary: {
      base: 'tw-text-blue-600 dark:tw-text-blue-300 focus:tw-outline-none',
      active: `active:tw-bg-transparent hover:tw-text-blue-600 active:tw-text-blue-600`,
    },
  },
};
