'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Search, 
  Users, 
  Plus, 
  MoreHorizontal, 
  Mail, 
  Shield,
  UserCheck,
  UserX
} from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  displayName?: string;
  roles?: Array<{
    id: string;
    name: string;
    displayName?: string;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    displayName?: string;
  }>;
  isAdmin: boolean;
  isBot: boolean;
  deleted: boolean;
  href?: string;
}

interface Team {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  href?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  // Fetch users and teams data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get the metadata access token from cookies
        const token = document.cookie
          .split(';')
          .find(row => row.trim().startsWith('metadata-access-token='))
          ?.split('=')[1];

        if (!token) {
          throw new Error('No access token available. Please sign in.');
        }

        const [usersResponse, teamsResponse] = await Promise.all([
          fetch('/api/v1/users', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }),
          fetch('/api/v1/teams', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })
        ]);

        if (!usersResponse.ok || !teamsResponse.ok) {
          throw new Error('Failed to fetch data from OpenMetadata');
        }

        const usersData = await usersResponse.json();
        const teamsData = await teamsResponse.json();
        
        setUsers(usersData.data || []);
        setTeams(teamsData.data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users and teams data. Please ensure OpenMetadata backend is running and you are authenticated.');
        setUsers([]);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter users based on search and team
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = selectedTeam === 'all' || 
                       user.teams?.some(team => team.id === selectedTeam);
    
    return matchesSearch && matchesTeam && !user.deleted;
  });

  const handleUserAction = (action: string, userId: string) => {
    // TODO: Implement user actions (activate/deactivate, edit role, etc.)
    toast.info(`${action} action for user ${userId} - Coming soon!`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeVariant = (isAdmin: boolean) => {
    return isAdmin ? 'default' : 'secondary';
  };

  const getStatusBadge = (user: User) => {
    if (user.isBot) {
      return <Badge variant="outline">Bot</Badge>;
    }
    if (user.deleted) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
      <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Teams</h1>
        <p className="text-muted-foreground">
            Manage users, teams, and access permissions
        </p>
      </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => !u.deleted).length}</div>
            <p className="text-xs text-muted-foreground">
              {users.filter(u => u.isAdmin).length} administrators
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredUsers.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently visible
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teams</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
            <p className="text-xs text-muted-foreground">
              Total teams
            </p>
          </CardContent>
        </Card>
      </div>

          {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              </div>
            </div>
            <div className="w-48">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">All Teams</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.displayName || team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage user accounts and permissions
          </CardDescription>
            </CardHeader>
            <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.displayName || user.name}</div>
                          {user.isBot && (
                            <div className="text-xs text-muted-foreground">Bot</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{user.email}</span>
                    </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.isAdmin)}>
                        {user.isAdmin ? 'Admin' : 'User'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.teams?.slice(0, 2).map(team => (
                          <Badge key={team.id} variant="outline" className="text-xs">
                            {team.displayName || team.name}
                          </Badge>
                        ))}
                        {user.teams && user.teams.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{user.teams.length - 2} more
                          </Badge>
                        )}
                    </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {!loading && filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No users found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
                  </div>
          )}
                </CardContent>
              </Card>
    </div>
  );
}
