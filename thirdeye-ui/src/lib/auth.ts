import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    // In a real application, you would fetch user data from your database
    return {
      id: decoded.userId,
      email: decoded.email,
      firstName: 'Admin', // Replace with actual user data
      lastName: 'User',
      company: 'ThirdEye',
      role: decoded.role || 'Viewer'
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export function hasPermission(user: User, permission: string): boolean {
  // Simple role-based permissions
  const permissions = {
    Admin: ['*'], // Admin has all permissions
    'Data Steward': ['read', 'write', 'manage_metadata'],
    'Data Engineer': ['read', 'write'],
    Analyst: ['read'],
    Viewer: ['read']
  };

  const userPermissions = permissions[user.role as keyof typeof permissions] || [];
  return userPermissions.includes('*') || userPermissions.includes(permission);
}
