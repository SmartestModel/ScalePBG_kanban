import { create } from 'zustand';
import { Project, Sprint, Organization } from '../types';

interface WorkspaceState {
  activeProject: Project | null;
  activeSprint: Sprint | null;
  projects: Project[];
  sprints: Sprint[];

  setProjects: (projects: Project[]) => void;
  setActiveProject: (project: Project | null) => void;
  setSprints: (sprints: Sprint[]) => void;
  setActiveSprint: (sprint: Sprint | null) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeProject: null,
  activeSprint: null,
  projects: [],
  sprints: [],

  setProjects: (projects) => set({ projects }),
  setActiveProject: (project) => set({ activeProject: project }),
  setSprints: (sprints) => set({ sprints }),
  setActiveSprint: (sprint) => set({ activeSprint: sprint }),

  reset: () =>
    set({
      activeProject: null,
      activeSprint: null,
      projects: [],
      sprints: [],
    }),
}));
