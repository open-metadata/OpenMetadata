import { Button } from '@/components/base/buttons/button';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { cx } from '@/utils/cx';
import { Eye, EyeOff, UploadCloud01 } from '@untitledui/icons';
import { useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { InputBase, TextField, type InputBaseProps } from './input';

interface BaseProps {
  label?: string;
  hint?: React.ReactNode;
  hideRequiredIndicator?: boolean;
  /** When true, shows an upload link-button in the label trailing area. */
  allowUpload?: boolean;
  /** Accepted file extensions forwarded to the file picker (e.g. ['.pem', '.key']). */
  acceptedFileTypes?: string[];
  /** Label for the upload button. Defaults to "Upload key file". */
  uploadLabel?: string;
}

export interface PasswordInputProps
  extends Omit<InputBaseProps, 'label' | 'hint' | 'trailingSlot'>,
    BaseProps {}

export const PasswordInput = ({
  size = 'sm',
  fontSize = 'md',
  placeholder,
  label,
  hint,
  hideRequiredIndicator,
  allowUpload = false,
  acceptedFileTypes,
  uploadLabel = 'Upload key file',
  ref,
  groupRef,
  iconClassName,
  inputClassName,
  wrapperClassName,
  tooltipClassName,
  // AriaTextField props go into ...props so they reach TextField/AriaTextField
  ...props
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const { onChange, isRequired, isDisabled, isInvalid, value } = props;

  const handleFileSelect = (files: FileList | null) => {
    if (files?.[0] && onChange) {
      files[0].text().then((content) => onChange(content));
    }
  };

  const revealButton = (
    <button
      className="tw:absolute tw:right-3 tw:flex tw:cursor-pointer tw:items-center tw:text-fg-quaternary tw:transition-colors tw:duration-200 hover:tw:text-fg-quaternary_hover tw:border-0 tw:bg-transparent tw:p-0"
      tabIndex={-1}
      type="button"
      onClick={() => setShowPassword((v) => !v)}>
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  const labelRow =
    label || allowUpload ? (
      <div className="tw:flex tw:w-full tw:items-baseline tw:justify-between tw:gap-2">
        {label && (
          <Label
            isRequired={
              hideRequiredIndicator ? !hideRequiredIndicator : isRequired
            }>
            {label}
          </Label>
        )}
        {allowUpload && (
          <FileTrigger
            acceptedFileTypes={acceptedFileTypes}
            onSelect={handleFileSelect}>
            <Button
              color="link-color"
              iconLeading={<UploadCloud01 data-icon size={13} />}
              isDisabled={isDisabled}
              size="xs"
              type="button">
              {uploadLabel}
            </Button>
          </FileTrigger>
        )}
      </div>
    ) : null;

  return (
    <TextField aria-label={label ?? placeholder} {...props} value={value ?? ''}>
      <>
        {labelRow}
        <InputBase
          fontSize={fontSize}
          groupRef={groupRef}
          iconClassName={iconClassName}
          inputClassName={cx('tw:pr-9', inputClassName)}
          isDisabled={isDisabled}
          isInvalid={isInvalid}
          isRequired={isRequired}
          placeholder={placeholder}
          ref={ref}
          size={size}
          tooltipClassName={tooltipClassName}
          trailingSlot={revealButton}
          type={showPassword ? 'text' : 'password'}
          wrapperClassName={wrapperClassName}
        />
        {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
      </>
    </TextField>
  );
};

PasswordInput.displayName = 'PasswordInput';
