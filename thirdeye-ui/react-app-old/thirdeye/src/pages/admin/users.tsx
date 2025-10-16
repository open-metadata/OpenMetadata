import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  MoreVertical, 
  Shield, 
  ShieldCheck, 
  Lock, 
  UserX, 
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2
} from 'lucide-react';
import { trpc } from '../../lib/trpc-client';
import { UserRole, UserStatus } from '@prisma/client';
import GlassCard from '../../components/ui/GlassCard';

const AdminUsersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [sortBy, setSortBy] = useState<'email' | 'name' | 'createdAt' | 'lastLoginAt' | 'role' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

  // Fetch users
  const { data: usersData, isLoading, refetch } = trpc.admin.users.listUsers.useQuery({
    page: currentPage,
    limit: 20,
    search: search || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    sortBy,
    sortOrder
  });

  // Fetch user details
  const { data: userDetailsData } = trpc.admin.users.getUserDetails.useQuery(
    { userId: selectedUser! },
    { enabled: !!selectedUser }
  );

  // Fetch user stats
  const { data: statsData } = trpc.admin.users.getUserStats.useQuery();

  // Mutations
  const setRoleMutation = trpc.admin.users.setUserRole.useMutation({
    onSuccess: () => {
      refetch();
      setShowUserDetails(false);
    }
  });

  const setStatusMutation = trpc.admin.users.setUserStatus.useMutation({
    onSuccess: () => {
      refetch();
      setShowUserDetails(false);
    }
  });

  const resetPasswordMutation = trpc.admin.users.resetUserPassword.useMutation({
    onSuccess: () => {
      refetch();
      setShowUserDetails(false);
    }
  });

  const handleSetRole = async (userId: string, newRole: UserRole) => {
    const reason = prompt('Please provide a reason for this role change:');
    if (reason) {
      await setRoleMutation.mutateAsync({ userId, role: newRole, reason });
    }
  };

  const handleSetStatus = async (userId: string, newStatus: UserStatus) => {
    const reason = prompt('Please provide a reason for this status change:');
    if (reason) {
      let lockUntil: Date | undefined;
      if (newStatus === UserStatus.SUSPENDED) {
        const days = prompt('How many days to lock? (leave empty for permanent):');
        if (days && !isNaN(Number(days))) {
          lockUntil = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
        }
      }
      await setStatusMutation.mutateAsync({ userId, status: newStatus, reason, lockUntil });
    }
  };

  const handleResetPassword = async (userId: string) => {
    const reason = prompt('Please provide a reason for this password reset:');
    if (reason) {
      await resetPasswordMutation.mutateAsync({ userId, reason });
    }
  };

  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ACTIVE:
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case UserStatus.INACTIVE:
        return <UserX className="w-4 h-4 text-gray-400" />;
      case UserStatus.SUSPENDED:
        return <Lock className="w-4 h-4 text-red-400" />;
      case UserStatus.PENDING_VERIFICATION:
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case UserStatus.DELETED:
        return <Trash2 className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return <ShieldCheck className="w-4 h-4 text-purple-400" />;
      case UserRole.MANAGER:
        return <Shield className="w-4 h-4 text-blue-400" />;
      default:
        return <Users className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ACTIVE:
        return 'text-green-400 bg-green-900/20';
      case UserStatus.INACTIVE:
        return 'text-gray-400 bg-gray-900/20';
      case UserStatus.SUSPENDED:
        return 'text-red-400 bg-red-900/20';
      case UserStatus.PENDING_VERIFICATION:
        return 'text-yellow-400 bg-yellow-900/20';
      case UserStatus.DELETED:
        return 'text-red-500 bg-red-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'text-purple-400 bg-purple-900/20';
      case UserRole.MANAGER:
        return 'text-blue-400 bg-blue-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  const users = usersData?.data.users || [];
  const pagination = usersData?.data.pagination;
  const stats = statsData?.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-gray-400">Manage users, roles, and account status</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Users</p>
                  <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Users</p>
                  <p className="text-2xl font-bold text-green-400">{stats.activeUsers}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Admins</p>
                  <p className="text-2xl font-bold text-purple-400">{stats.adminUsers}</p>
                </div>
                <ShieldCheck className="w-8 h-8 text-purple-400" />
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Recent Logins</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.recentLogins}</p>
                </div>
                <RefreshCw className="w-8 h-8 text-blue-400" />
              </div>
            </GlassCard>
          </div>
        )}

        {/* Filters */}
        <GlassCard className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Search users..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Roles</option>
                <option value={UserRole.ADMIN}>Admin</option>
                <option value={UserRole.MANAGER}>Manager</option>
                <option value={UserRole.USER}>User</option>
                <option value={UserRole.READONLY}>Read Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Statuses</option>
                <option value={UserStatus.ACTIVE}>Active</option>
                <option value={UserStatus.INACTIVE}>Inactive</option>
                <option value={UserStatus.SUSPENDED}>Suspended</option>
                <option value={UserStatus.PENDING_VERIFICATION}>Pending</option>
                <option value={UserStatus.DELETED}>Deleted</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="email-asc">Email A-Z</option>
                <option value="email-desc">Email Z-A</option>
                <option value="lastLoginAt-desc">Last Login</option>
                <option value="role-asc">Role</option>
              </select>
            </div>
          </div>
        </GlassCard>

        {/* Users Table */}
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">User</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Role</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Last Login</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Created</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-white">{user.name || 'No name'}</div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${getRoleColor(user.role)}`}>
                          {getRoleIcon(user.role)}
                          <span>{user.role}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${getStatusColor(user.status)}`}>
                          {getStatusIcon(user.status)}
                          <span>{user.status}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user.id);
                              setShowUserDetails(true);
                            }}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <div className="relative">
                            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {/* Dropdown menu would go here */}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/20">
              <div className="text-sm text-gray-400">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} users
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(pagination.page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="px-3 py-1 text-sm bg-white/5 border border-white/20 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-3 py-1 text-sm bg-white/5 border border-white/20 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default AdminUsersPage;
