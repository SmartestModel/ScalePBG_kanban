import React from 'react';
import { UserRole } from '../../types';

interface AvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  role?: UserRole;
  className?: string;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}) => {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? 'User'}
        className={`avatar avatar-${size} ${className}`}
        style={{ objectFit: 'cover' }}
      />
    );
  }
  return (
    <div
      className={`avatar avatar-${size} ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
};

interface RoleBadgeProps { role: UserRole; }
export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => (
  <span className={`badge badge-role-${role}`}>
    {role.charAt(0).toUpperCase() + role.slice(1)}
  </span>
);
