import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { trpc } from '../../lib/trpc-client';
import { useAuthStore } from '../../state/auth';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedButton } from '../../components/ui/AnimatedButton';

interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ChangeEmailFormData {
  newEmail: string;
  currentPassword: string;
}

export function SecuritySettings() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'password' | 'email'>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const passwordForm = useForm<ChangePasswordFormData>();
  const emailForm = useForm<ChangeEmailFormData>();

  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully! All sessions have been logged out for security.' });
        passwordForm.reset();
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const changeEmailMutation = trpc.user.changeEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage({ type: 'success', text: 'Email change request sent! Please check your new email for verification.' });
        emailForm.reset();
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const onSubmitPassword = async (data: ChangePasswordFormData) => {
    if (data.newPassword !== data.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    });
  };

  const onSubmitEmail = async (data: ChangeEmailFormData) => {
    setIsLoading(true);
    setMessage(null);
    changeEmailMutation.mutate(data);
  };

  const clearMessage = () => setMessage(null);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Security Settings</h1>
        <p className="text-gray-300">Manage your account security and authentication</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-8">
        <button
          onClick={() => { setActiveTab('password'); clearMessage(); }}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'password'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
          }`}
        >
          Change Password
        </button>
        <button
          onClick={() => { setActiveTab('email'); clearMessage(); }}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'email'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
          }`}
        >
          Change Email
        </button>
      </div>

      {/* Password Change Form */}
      {activeTab === 'password' && (
        <GlassCard className="p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Change Password</h2>
            <p className="text-gray-400">Update your password to keep your account secure</p>
          </div>

          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-6">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Current Password
              </label>
              <input
                {...passwordForm.register('currentPassword', { required: 'Current password is required' })}
                type="password"
                id="currentPassword"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your current password"
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="mt-1 text-sm text-red-400">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                New Password
              </label>
              <input
                {...passwordForm.register('newPassword', { 
                  required: 'New password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                })}
                type="password"
                id="newPassword"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your new password"
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="mt-1 text-sm text-red-400">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                {...passwordForm.register('confirmPassword', { required: 'Please confirm your new password' })}
                type="password"
                id="confirmPassword"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm your new password"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Security Notice */}
            <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-blue-400 font-medium">Security Notice</h4>
                  <p className="text-blue-300 text-sm mt-1">
                    Changing your password will log you out of all devices for security. You'll need to sign in again.
                  </p>
                </div>
              </div>
            </div>

            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-900/50 border border-green-600 text-green-400' 
                  : 'bg-red-900/50 border border-red-600 text-red-400'
              }`}>
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <AnimatedButton
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Changing Password...' : 'Change Password'}
              </AnimatedButton>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Email Change Form */}
      {activeTab === 'email' && (
        <GlassCard className="p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Change Email Address</h2>
            <p className="text-gray-400">Update your email address. You'll receive a verification email at the new address.</p>
          </div>

          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-300">
              <span className="font-medium">Current email:</span> {user?.email}
            </p>
          </div>

          <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-6">
            {/* New Email */}
            <div>
              <label htmlFor="newEmail" className="block text-sm font-medium text-gray-300 mb-2">
                New Email Address
              </label>
              <input
                {...emailForm.register('newEmail', { 
                  required: 'New email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                type="email"
                id="newEmail"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your new email address"
              />
              {emailForm.formState.errors.newEmail && (
                <p className="mt-1 text-sm text-red-400">{emailForm.formState.errors.newEmail.message}</p>
              )}
            </div>

            {/* Current Password for Verification */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Current Password
              </label>
              <input
                {...emailForm.register('currentPassword', { required: 'Current password is required' })}
                type="password"
                id="currentPassword"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your current password to confirm"
              />
              {emailForm.formState.errors.currentPassword && (
                <p className="mt-1 text-sm text-red-400">{emailForm.formState.errors.currentPassword.message}</p>
              )}
            </div>

            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-900/50 border border-green-600 text-green-400' 
                  : 'bg-red-900/50 border border-red-600 text-red-400'
              }`}>
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <AnimatedButton
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending Request...' : 'Change Email'}
              </AnimatedButton>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  );
}
