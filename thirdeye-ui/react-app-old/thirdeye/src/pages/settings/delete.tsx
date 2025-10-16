import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, Eye, EyeOff, Shield } from 'lucide-react';
import { trpc } from '../../lib/trpc-client';
import { useAuth } from '../../state/auth';
import GlassCard from '../../components/ui/GlassCard';

const DeleteAccount: React.FC = () => {
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const deleteAccountMutation = trpc.user.deleteSelf.useMutation({
    onSuccess: () => {
      // Clear auth state and redirect to login
      clearAuth();
      navigate('/login', { 
        state: { 
          message: 'Your account has been permanently deleted.',
          type: 'success'
        }
      });
    },
    onError: (error) => {
      setError(error.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  });

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (confirmText !== 'DELETE') {
      setError('Please type "DELETE" to confirm account deletion.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password to confirm account deletion.');
      return;
    }

    setIsDeleting(true);
    
    try {
      await deleteAccountMutation.mutateAsync({
        password: password.trim(),
        confirmText: confirmText
      });
    } catch (error) {
      // Error handling is done in onError callback
    }
  };

  const canDelete = confirmText === 'DELETE' && password.trim().length > 0 && !isDeleting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Delete Account</h1>
          <p className="text-gray-400">
            Permanently delete your account and all associated data.
          </p>
        </div>

        <GlassCard className="border-red-500/20 bg-red-900/10">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-red-400 mb-2">
                Warning: This action cannot be undone
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  Deleting your account will permanently remove:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Your profile and personal information</li>
                  <li>All authentication tokens and sessions</li>
                  <li>Account preferences and settings</li>
                  <li>Any saved data or configurations</li>
                  <li>OAuth provider connections</li>
                </ul>
                <p className="text-red-300 font-medium">
                  This action is irreversible. Please ensure you want to proceed.
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="mt-6">
          <form onSubmit={handleDelete} className="space-y-6">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Security Verification
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  To delete your account, please verify your identity by entering your password.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your current password"
                    disabled={isDeleting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    disabled={isDeleting}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirmation Text */}
              <div>
                <label htmlFor="confirmText" className="block text-sm font-medium text-gray-300 mb-2">
                  Type "DELETE" to confirm
                </label>
                <input
                  id="confirmText"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Type DELETE"
                  disabled={isDeleting}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300">{error}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={!canDelete}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </GlassCard>

        {/* Additional Information */}
        <div className="mt-8 p-6 bg-blue-900/20 border border-blue-500/20 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">
            What happens after deletion?
          </h3>
          <div className="text-gray-300 space-y-2 text-sm">
            <p>• You will be immediately logged out and redirected to the login page</p>
            <p>• All your data will be permanently removed from our systems</p>
            <p>• You will no longer be able to access your account</p>
            <p>• If you have any questions, please contact support before deleting</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccount;
