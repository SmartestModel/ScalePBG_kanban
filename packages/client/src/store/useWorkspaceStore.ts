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

const SAVED_PROJECT_KEY = 'kanban_active_project_id';

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeProject: null,
  activeSprint: null,
  projects: [],
  sprints: [],

  setProjects: (projects) => {
    set({ projects });
    // If no active project selected yet, restore from localStorage or default to first project
    const savedId = localStorage.getItem(SAVED_PROJECT_KEY);
    const matched = savedId ? projects.find((p) => p.id === savedId) : null;
    const initialProject = matched ?? (projects.length > 0 ? projects[0] : null);
    if (initialProject) {
      set({ activeProject: initialProject });
      localStorage.setItem(SAVED_PROJECT_KEY, initialProject.id);
    }
  },

  setActiveProject: (project) => {
    set({ activeProject: project });
    if (project) {
      localStorage.setItem(SAVED_PROJECT_KEY, project.id);
    } else {
      localStorage.removeItem(SAVED_PROJECT_KEY);
    }
  },

  setSprints: (sprints) => set({ sprints }),
  setActiveSprint: (sprint) => set({ activeSprint: sprint }),

  reset: () => {
    localStorage.removeItem(SAVED_PROJECT_KEY);
    set({
      activeProject: null,
      activeSprint: null,
      projects: [],
      sprints: [],
    });
  },
}));
