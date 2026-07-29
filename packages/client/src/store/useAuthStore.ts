import { create } from 'zustand';
import { User, Organization, UserRole } from '../types';

interface AuthState {
  user: User | null;
  firebaseUser: { uid: string; email: string | null } | null;
  orgs: Organization[];
  activeOrgId: string | null;
  activeRole: UserRole | null;
  isLoading: boolean;

  setFirebaseUser: (fbUser: { uid: string; email: string | null } | null) => void;
  setProfile: (user: User, orgs: Organization[]) => void;
  setActiveOrg: (orgId: string, role: UserRole) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null,
  orgs: [],
  activeOrgId: null,
  activeRole: null,
  isLoading: true,

  setFirebaseUser: (fbUser) => set({ firebaseUser: fbUser }),

  setProfile: (user, orgs) =>
    set({ user, orgs, isLoading: false }),

  setActiveOrg: (orgId, role) =>
    set({ activeOrgId: orgId, activeRole: role }),

  setLoading: (isLoading) => set({ isLoading }),

  reset: () =>
    set({
      user: null,
      firebaseUser: null,
      orgs: [],
      activeOrgId: null,
      activeRole: null,
      isLoading: false,
    }),
}));
