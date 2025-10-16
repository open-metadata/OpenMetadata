import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { trpc } from '../lib/trpc-client';
import AuthCard from '../components/auth/AuthCard';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);

  const token = searchParams.get('token');

  // Use tRPC mutation for email verification
  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      console.log('Email verification successful:', data);
      setStatus('success');
      setMessage('Your email has been successfully verified! You can now access all features.');
    },
    onError: (error) => {
      console.error('Email verification error:', error);
      setStatus('error');
      setMessage(error.message || 'Email verification failed. The link may be expired or invalid.');
    },
  });

  // Use tRPC mutation for resending verification email
  const resendMutation = trpc.auth.requestEmailVerification.useMutation({
    onSuccess: () => {
      setMessage('Verification email sent! Please check your inbox.');
      setIsResending(false);
    },
    onError: (error) => {
      setMessage(error.message || 'Failed to resend verification email.');
      setIsResending(false);
    },
  });

  useEffect(() => {
    if (token) {
      setStatus('loading');
      verifyMutation.mutate({ token });
    }
  }, [token]);

  const handleResendVerification = () => {
    setIsResending(true);
    // Note: This would need the user's email, which we don't have in this component
    // In a real app, you'd either store it in localStorage or ask the user to enter it
    setMessage('Please use the signup page to request a new verification email.');
    setIsResending(false);
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Verifying Email</h2>
            <p className="text-gray-300">Please wait while we verify your email address...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Email Verified!</h2>
            <p className="text-gray-300 mb-6">{message}</p>
            <Link
              to="/login"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
            >
              Continue to Login
            </Link>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Verification Failed</h2>
            <p className="text-gray-300 mb-6">{message}</p>
            
            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full bg-white/10 border border-white/20 text-white py-3 px-4 rounded-lg font-medium hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span>Resend Verification Email</span>
                  </>
                )}
              </button>
              
              <Link
                to="/signup"
                className="block w-full text-center text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Create New Account
              </Link>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-500/20 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Email Verification</h2>
            <p className="text-gray-300 mb-6">
              Please check your email and click the verification link to activate your account.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full bg-white/10 border border-white/20 text-white py-3 px-4 rounded-lg font-medium hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span>Resend Verification Email</span>
                  </>
                )}
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
    }
  };

  const footer = (
    <div className="text-center">
      <p className="text-gray-300 text-sm">
        Need help?{' '}
        <Link 
          to="/contact" 
          className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
        >
          Contact Support
        </Link>
      </p>
    </div>
  );

  return (
    <AuthCard 
      title="Email Verification"
      subtitle={token ? "Verifying your email address..." : "Check your email for verification link"}
      footer={footer}
    >
      {renderContent()}
    </AuthCard>
  );
};

export default VerifyEmail;
