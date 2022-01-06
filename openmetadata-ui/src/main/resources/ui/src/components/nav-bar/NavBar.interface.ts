import { DropDownListItem } from '../dropdown/types';

export interface NavBarProps {
  settingDropdown: DropDownListItem[];
  supportDropdown: DropDownListItem[];
  profileDropdown: DropDownListItem[];
  searchValue: string;
  isTourRoute?: boolean;
  isFeatureModalOpen: boolean;
  pathname: string;
  isSearchBoxOpen: boolean;
  handleSearchBoxOpen: (value: boolean) => void;
  handleFeatureModal: (value: boolean) => void;
  handleSearchChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}
