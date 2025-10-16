import React, { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc-client';
import AuthCard from '../components/auth/AuthCard';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Use tRPC mutation for password reset request
  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      console.log('Password reset request successful:', data);
      setStatus('success');
      setMessage('Password reset instructions have been sent to your email address. Please check your inbox and follow the link to reset your password.');
    },
    onError: (error) => {
      console.error('Password reset request error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to send password reset email. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMessage('Please enter your email address');
      setStatus('error');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setMessage('Please enter a valid email address');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');
    
    resetMutation.mutate({ email });
  };

  const renderContent = () => {
    switch (status) {
      case 'success':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Email Sent!</h2>
            <p className="text-gray-300 mb-6">{message}</p>
            
            <div className="space-y-3">
              <Link
                to="/login"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
              >
                Back to Login
              </Link>
              
              <p className="text-gray-400 text-sm">
                Didn't receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => setStatus('idle')}
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  try again
                </button>
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
            <p className="text-gray-300 mb-6">{message}</p>
            
            <div className="space-y-3">
              <button
                onClick={() => setStatus('idle')}
                className="w-full bg-white/10 border border-white/20 text-white py-3 px-4 rounded-lg font-medium hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
              >
                Try Again
              </button>
              
              <Link
                to="/login"
                className="block w-full text-center text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Back to Login
              </Link>
            </div>
          </div>
        );

      default:
        return (
          <>
            {/* Back Button */}
            <div className="mb-6">
              <Link
                to="/login"
                className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Link>
            </div>

            {/* Reset Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={resetMutation.isPending || status === 'loading'}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {resetMutation.isPending || status === 'loading' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
            </form>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-200 text-sm">
                <strong>Note:</strong> If you don't receive an email within a few minutes, please check your spam folder. 
                The reset link will expire in 1 hour for security reasons.
              </p>
            </div>
          </>
        );
    }
  };

  const footer = (
    <div className="text-center">
      <p className="text-gray-300 text-sm">
        Remember your password?{' '}
        <Link 
          to="/login" 
          className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );

  return (
    <AuthCard 
      title="Reset Password"
      subtitle="Enter your email to receive reset instructions"
      footer={footer}
    >
      {renderContent()}
    </AuthCard>
  );
};

export default ForgotPassword;
