export interface DisplayNameComponentProps {
  isDisplayNameEdit: boolean;
  displayName: string | undefined;
  onDisplayNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsDisplayNameEdit: (value: boolean) => void;
  handleDisplayNameChange: () => void;
  displayNamePermission: boolean;
  editAllPermission: boolean;
}
