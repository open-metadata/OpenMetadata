import { AvatarLabelGroup } from '@/components/base/avatar/avatar-label-group';
import { Button } from '@/components/base/buttons/button';
import { RadioButtonBase } from '@/components/base/radio-buttons/radio-buttons';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cx } from '@/utils/cx';
import type { Placement } from '@react-types/overlays';
import {
  BookOpen01,
  ChevronSelectorVertical,
  LogOut01,
  Plus,
  Settings01,
  User01,
} from '@untitledui/icons';
import type { FC, HTMLAttributes } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useFocusManager } from 'react-aria';
import type { DialogProps as AriaDialogProps } from 'react-aria-components';
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
} from 'react-aria-components';

type NavAccountType = {
  /** Unique identifier for the nav item. */
  id: string;
  /** Name of the account holder. */
  name: string;
  /** Email address of the account holder. */
  email: string;
  /** Avatar image URL. */
  avatar: string;
  /** Online status of the account holder. This is used to display the online status indicator. */
  status: 'online' | 'offline';
};

const placeholderAccounts: NavAccountType[] = [
  {
    id: 'olivia',
    name: 'Olivia Rhye',
    email: 'olivia@untitledui.com',
    avatar:
      'https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80',
    status: 'online',
  },
  {
    id: 'sienna',
    name: 'Sienna Hewitt',
    email: 'sienna@untitledui.com',
    avatar:
      'https://www.untitledui.com/images/avatars/transparent/sienna-hewitt?bg=%23E0E0E0',
    status: 'online',
  },
];

const NavAccountCardMenuItem = ({
  icon: Icon,
  label,
  shortcut,
  ...buttonProps
}: {
  icon?: FC<{ className?: string }>;
  label: string;
  shortcut?: string;
} & HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      {...buttonProps}
      className={cx(
        'tw:group/item tw:w-full tw:cursor-pointer tw:px-1.5 tw:focus:outline-hidden',
        buttonProps.className
      )}>
      <div
        className={cx(
          'tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:rounded-md tw:p-2 tw:group-hover/item:bg-primary_hover',
          'tw:outline-focus-ring tw:group-focus-visible/item:outline-2 tw:group-focus-visible/item:outline-offset-2'
        )}>
        <div className="tw:flex tw:gap-2 tw:text-sm tw:font-semibold tw:text-secondary tw:group-hover/item:text-secondary_hover">
          {Icon && <Icon className="tw:size-5 tw:text-fg-quaternary" />} {label}
        </div>

        {shortcut && (
          <kbd className="tw:flex tw:rounded tw:px-1 tw:py-px tw:font-body tw:text-xs tw:font-medium tw:text-tertiary tw:ring-1 tw:ring-secondary tw:ring-inset">
            {shortcut}
          </kbd>
        )}
      </div>
    </button>
  );
};

export const NavAccountMenu = ({
  className,
  accounts = placeholderAccounts,
  selectedAccountId = placeholderAccounts[0].id,
  ...dialogProps
}: AriaDialogProps & {
  className?: string;
  accounts?: NavAccountType[];
  selectedAccountId?: string;
}) => {
  const focusManager = useFocusManager();
  const dialogRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          focusManager?.focusNext({ tabbable: true, wrap: true });

          break;
        case 'ArrowUp':
          focusManager?.focusPrevious({ tabbable: true, wrap: true });

          break;
      }
    },
    [focusManager]
  );

  useEffect(() => {
    const element = dialogRef.current;
    if (element) {
      element.addEventListener('keydown', onKeyDown);
    }

    return () => {
      if (element) {
        element.removeEventListener('keydown', onKeyDown);
      }
    };
  }, [onKeyDown]);

  return (
    <AriaDialog
      {...dialogProps}
      className={cx(
        'tw:w-66 tw:rounded-xl tw:bg-secondary_alt tw:shadow-lg tw:ring tw:ring-secondary_alt tw:outline-hidden',
        className
      )}
      ref={dialogRef}>
      <div className="tw:rounded-xl tw:bg-primary tw:ring-1 tw:ring-secondary">
        <div className="tw:flex tw:flex-col tw:gap-0.5 tw:py-1.5">
          <NavAccountCardMenuItem
            icon={User01}
            label="View profile"
            shortcut="⌘K->P"
          />
          <NavAccountCardMenuItem
            icon={Settings01}
            label="Account settings"
            shortcut="⌘S"
          />
          <NavAccountCardMenuItem icon={BookOpen01} label="Documentation" />
        </div>
        <div className="tw:flex tw:flex-col tw:gap-0.5 tw:border-t tw:border-secondary tw:py-1.5">
          <div className="tw:px-3 tw:pt-1.5 tw:pb-1 tw:text-xs tw:font-semibold tw:text-tertiary">
            Switch account
          </div>

          <div className="tw:flex tw:flex-col tw:gap-0.5 tw:px-1.5">
            {accounts.map((account) => (
              <button
                className={cx(
                  'tw:relative tw:w-full tw:cursor-pointer tw:rounded-md tw:px-2 tw:py-1.5 tw:text-left tw:outline-focus-ring tw:hover:bg-primary_hover tw:focus:z-10 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2',
                  account.id === selectedAccountId && 'tw:bg-primary_hover'
                )}
                key={account.id}>
                <AvatarLabelGroup
                  size="md"
                  src={account.avatar}
                  status="online"
                  subtitle={account.email}
                  title={account.name}
                />

                <RadioButtonBase
                  className="tw:absolute tw:top-2 tw:right-2"
                  isSelected={account.id === selectedAccountId}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="tw:flex tw:flex-col tw:gap-2 tw:px-2 tw:pt-0.5 tw:pb-2">
          <Button color="secondary" iconLeading={Plus} size="sm">
            Add account
          </Button>
        </div>
      </div>

      <div className="tw:pt-1 tw:pb-1.5">
        <NavAccountCardMenuItem
          icon={LogOut01}
          label="Sign out"
          shortcut="⌥⇧Q"
        />
      </div>
    </AriaDialog>
  );
};

export const NavAccountCard = ({
  popoverPlacement,
  selectedAccountId,
  items = placeholderAccounts,
}: {
  popoverPlacement?: Placement;
  selectedAccountId?: string;
  items?: NavAccountType[];
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const isDesktop = useBreakpoint('lg');

  const resolvedSelectedId = selectedAccountId ?? items[0]?.id;
  const selectedAccount = items.find(
    (account) => account.id === resolvedSelectedId
  );

  if (!selectedAccount) {
    // eslint-disable-next-line no-console
    console.warn(
      `Account with ID ${resolvedSelectedId} not found in <NavAccountCard />`
    );

    return null;
  }

  return (
    <div
      className="tw:relative tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:p-3 tw:ring-1 tw:ring-secondary tw:ring-inset"
      ref={triggerRef}>
      <AvatarLabelGroup
        size="md"
        src={selectedAccount.avatar}
        status={selectedAccount.status}
        subtitle={selectedAccount.email}
        title={selectedAccount.name}
      />

      <div className="tw:absolute tw:top-1.5 tw:right-1.5">
        <AriaDialogTrigger>
          <AriaButton className="tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-md tw:p-1.5 tw:text-fg-quaternary tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:pressed:bg-primary_hover tw:pressed:text-fg-quaternary_hover">
            <ChevronSelectorVertical className="tw:size-4 tw:shrink-0" />
          </AriaButton>
          <AriaPopover
            className={({ isEntering, isExiting }) =>
              cx(
                'tw:origin-(--trigger-anchor-point) tw:will-change-transform',
                isEntering &&
                  'tw:duration-150 tw:ease-out tw:animate-in tw:fade-in tw:placement-right:slide-in-from-left-0.5 tw:placement-top:slide-in-from-bottom-0.5 tw:placement-bottom:slide-in-from-top-0.5',
                isExiting &&
                  'tw:duration-100 tw:ease-in tw:animate-out tw:fade-out tw:placement-right:slide-out-to-left-0.5 tw:placement-top:slide-out-to-bottom-0.5 tw:placement-bottom:slide-out-to-top-0.5'
              )
            }
            offset={8}
            placement={
              popoverPlacement ?? (isDesktop ? 'right bottom' : 'top right')
            }
            triggerRef={triggerRef}>
            <NavAccountMenu
              accounts={items}
              selectedAccountId={resolvedSelectedId}
            />
          </AriaPopover>
        </AriaDialogTrigger>
      </div>
    </div>
  );
};
