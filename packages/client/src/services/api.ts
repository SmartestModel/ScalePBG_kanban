import axios from 'axios';
import {
  doc, getDoc, setDoc, getDocs, collection, query, where, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import type {
  User, Organization, OrgMember, AccessRequest,
  Project, Epic, Story, Task, Subtask, Sprint, SprintItem,
  Comment, BurndownSnapshot, ApiResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';
const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const apiClient = axios.create({ baseURL: BASE_URL });

apiClient.interceptors.request.use(async (config) => {
  if (IS_MOCK) return config;
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Direct Cloud Firestore mode is active unless mock mode is explicitly enabled */
function shouldUseDirectFirestore(): boolean {
  if (IS_MOCK) return false;
  return true;
}

function isNetworkError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    return err.code === 'ERR_NETWORK' || !err.response;
  }
  return false;
}

function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const syncProfile = async (): Promise<ApiResponse<{ user: User; orgs: Organization[] }>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post('/auth/sync-profile');
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  if (auth.currentUser) {
    const fbUser = auth.currentUser;
    const now = new Date().toISOString();
    const userObj: User = {
      id: fbUser.uid,
      email: fbUser.email ?? '',
      name: fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'User',
      avatarUrl: fbUser.photoURL ?? undefined,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'users', fbUser.uid), cleanForFirestore(userObj), { merge: true });

    const orgsSnap = await getDocs(collection(db, 'organizations'));
    const userOrgs: Organization[] = [];

    for (const orgDoc of orgsSnap.docs) {
      const memRef = doc(db, 'organizations', orgDoc.id, 'members', fbUser.uid);
      const memSnap = await getDoc(memRef);
      if (memSnap.exists()) {
        const d = orgDoc.data();
        userOrgs.push({
          id: orgDoc.id,
          name: d.name,
          slug: d.slug,
          ownerId: d.ownerId,
          createdAt: d.createdAt ?? now,
        });
      }
    }

    return { success: true, data: { user: userObj, orgs: userOrgs } };
  }

  return { success: false, error: { message: 'Not authenticated' } };
};

export const getMe = (): Promise<ApiResponse<{ user: User; orgs: Organization[] }>> =>
  syncProfile();

// ── Organizations ─────────────────────────────────────────────────────────────

export const createOrg = async (data: { name: string; slug: string }): Promise<ApiResponse<Organization>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post('/orgs', data);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  if (auth.currentUser) {
    const fbUser = auth.currentUser;
    const now = new Date().toISOString();
    
    const slugQuery = query(collection(db, 'organizations'), where('slug', '==', data.slug));
    const slugSnap = await getDocs(slugQuery);
    if (!slugSnap.empty) {
      return { success: false, error: { message: 'Organization slug already taken.' } };
    }

    const orgRef = doc(collection(db, 'organizations'));
    const newOrg: Organization = {
      id: orgRef.id,
      name: data.name,
      slug: data.slug,
      ownerId: fbUser.uid,
      createdAt: now,
    };
    await setDoc(orgRef, cleanForFirestore(newOrg));

    const memberRef = doc(db, 'organizations', orgRef.id, 'members', fbUser.uid);
    await setDoc(memberRef, cleanForFirestore({
      uid: fbUser.uid,
      role: 'admin',
      capacityHoursPerWeek: 40,
      joinedAt: now,
    }));

    return { success: true, data: newOrg };
  }

  return { success: false, error: { message: 'User not authenticated' } };
};

export const searchOrgBySlug = async (slug: string): Promise<ApiResponse<Pick<Organization, 'id' | 'name' | 'slug'>>> => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get('/orgs/search', { params: { slug: normalizedSlug } });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const q = query(collection(db, 'organizations'), where('slug', '==', normalizedSlug));
  const snap = await getDocs(q);
  if (snap.empty) {
    return { success: false, error: { message: 'Organization not found.' } };
  }
  const d = snap.docs[0].data();
  return { success: true, data: { id: snap.docs[0].id, name: d.name, slug: d.slug } };
};

export const getAllPublicOrgs = async (): Promise<ApiResponse<Pick<Organization, 'id' | 'name' | 'slug'>[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get('/orgs');
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const snap = await getDocs(collection(db, 'organizations'));
  const orgs = snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, name: data.name, slug: data.slug };
  });
  return { success: true, data: orgs };
};

export const getOrg = async (orgId: string): Promise<ApiResponse<Organization>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/orgs/${orgId}`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const snap = await getDoc(doc(db, 'organizations', orgId));
  if (!snap.exists()) return { success: false, error: { message: 'Organization not found' } };
  const d = snap.data();
  return { success: true, data: { id: snap.id, name: d.name, slug: d.slug, ownerId: d.ownerId, createdAt: d.createdAt } };
};

export const getOrgMembers = async (orgId: string): Promise<ApiResponse<OrgMember[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/orgs/${orgId}/members`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const memSnap = await getDocs(collection(db, 'organizations', orgId, 'members'));
  const members: OrgMember[] = [];
  for (const d of memSnap.docs) {
    const mData = d.data();
    const userDoc = await getDoc(doc(db, 'users', d.id));
    const uData = userDoc.data();
    members.push({
      uid: d.id,
      role: mData.role ?? 'member',
      capacityHoursPerWeek: mData.capacityHoursPerWeek ?? 40,
      joinedAt: mData.joinedAt ?? new Date().toISOString(),
      name: uData?.name ?? 'User',
      email: uData?.email,
      avatarUrl: uData?.avatarUrl,
    });
  }
  return { success: true, data: members };
};

export const updateMemberRole = async (orgId: string, uid: string, role: string): Promise<ApiResponse<void>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.patch(`/orgs/${orgId}/members/${uid}`, { role });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const memberRef = doc(db, 'organizations', orgId, 'members', uid);
  await updateDoc(memberRef, { role });
  return { success: true, data: undefined };
};

export const getAccessRequests = async (orgId: string, status?: string): Promise<ApiResponse<AccessRequest[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/orgs/${orgId}/access-requests`, { params: { status } });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const constraints: any[] = [where('orgId', '==', orgId)];
  if (status) constraints.push(where('status', '==', status));

  const q = query(collection(db, 'access_requests'), ...constraints);
  const snap = await getDocs(q);
  const requests: AccessRequest[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      orgId: data.orgId,
      userId: data.userId,
      userEmail: data.userEmail ?? '',
      userName: data.userName ?? 'User',
      status: data.status ?? 'pending',
      requestedAt: data.requestedAt ?? new Date().toISOString(),
    };
  });
  return { success: true, data: requests };
};

export const createAccessRequest = async (orgId: string): Promise<ApiResponse<AccessRequest>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post('/access-requests', { orgId });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  if (auth.currentUser) {
    const fbUser = auth.currentUser;
    const now = new Date().toISOString();
    const reqRef = doc(collection(db, 'access_requests'));
    const requestObj: AccessRequest = {
      id: reqRef.id,
      orgId,
      userId: fbUser.uid,
      userEmail: fbUser.email ?? '',
      userName: fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'User',
      status: 'pending',
      requestedAt: now,
    };
    await setDoc(reqRef, cleanForFirestore(requestObj));
    return { success: true, data: requestObj };
  }

  return { success: false, error: { message: 'Not authenticated' } };
};

export const getMyAccessRequests = async (): Promise<ApiResponse<AccessRequest[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get('/access-requests/my');
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  if (!auth.currentUser) return { success: true, data: [] };
  const q = query(collection(db, 'access_requests'), where('userId', '==', auth.currentUser.uid));
  const snap = await getDocs(q);
  const requests: AccessRequest[] = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }) as AccessRequest);
  return { success: true, data: requests };
};

export const reviewAccessRequest = async (requestId: string, status: 'approved' | 'rejected'): Promise<ApiResponse<AccessRequest>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.patch(`/access-requests/${requestId}`, { status });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const reqRef = doc(db, 'access_requests', requestId);
  await updateDoc(reqRef, { status });
  const snap = await getDoc(reqRef);
  const reqData = snap.data() as AccessRequest;

  if (status === 'approved' && reqData) {
    const memRef = doc(db, 'organizations', reqData.orgId, 'members', reqData.userId);
    await setDoc(memRef, cleanForFirestore({
      uid: reqData.userId,
      role: 'member',
      capacityHoursPerWeek: 40,
      joinedAt: new Date().toISOString(),
    }), { merge: true });
  }

  return { success: true, data: reqData ? { ...reqData, id: snap.id } : ({} as AccessRequest) };
};

// ── Projects ──────────────────────────────────────────────────────────────────

export const getOrgProjects = async (orgId: string): Promise<ApiResponse<Project[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/orgs/${orgId}/projects`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const q = query(collection(db, 'projects'), where('orgId', '==', orgId));
  const snap = await getDocs(q);
  const projects: Project[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      orgId: data.orgId,
      key: data.key,
      name: data.name,
      description: data.description,
      createdAt: data.createdAt ?? new Date().toISOString(),
    };
  });
  return { success: true, data: projects };
};

export const createProject = async (orgId: string, data: { name: string; key: string; description?: string }): Promise<ApiResponse<Project>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post(`/orgs/${orgId}/projects`, data);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const pRef = doc(collection(db, 'projects'));
  const now = new Date().toISOString();
  const newProj: Project = {
    id: pRef.id,
    orgId,
    key: data.key,
    name: data.name,
    description: data.description,
    createdAt: now,
  };
  await setDoc(pRef, cleanForFirestore(newProj));
  return { success: true, data: newProj };
};

export const getProject = async (projectId: string): Promise<ApiResponse<Project>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/projects/${projectId}`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) return { success: false, error: { message: 'Project not found' } };
  return { success: true, data: { id: snap.id, ...snap.data() } as Project };
};

export const getBacklog = async (projectId: string): Promise<ApiResponse<Task[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/projects/${projectId}/backlog`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const q = query(
    collection(db, 'tasks'),
    where('projectId', '==', projectId),
    where('status', '==', 'backlog')
  );
  const snap = await getDocs(q);
  const tasks: Task[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      projectId: data.projectId,
      storyId: data.storyId,
      assigneeId: data.assigneeId,
      title: data.title,
      description: data.description,
      estimateHours: data.estimateHours ?? 0,
      priority: data.priority ?? 'medium',
      status: data.status ?? 'backlog',
      labelIds: data.labelIds ?? [],
      version: data.version ?? 1,
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  });
  return { success: true, data: tasks };
};

export const getEpics = async (projectId: string): Promise<ApiResponse<Epic[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/projects/${projectId}/epics`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const q = query(collection(db, 'epics'), where('projectId', '==', projectId));
  const snap = await getDocs(q);
  const epics: Epic[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      projectId: data.projectId,
      title: data.title,
      goal: data.goal,
      color: data.color ?? '#3B82F6',
      status: data.status ?? 'open',
      createdAt: data.createdAt ?? new Date().toISOString(),
    };
  });
  return { success: true, data: epics };
};

export const createEpic = async (projectId: string, data: { title: string; goal?: string; color?: string }): Promise<ApiResponse<Epic>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post(`/projects/${projectId}/epics`, data);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const eRef = doc(collection(db, 'epics'));
  const now = new Date().toISOString();
  const newEpic: Epic = {
    id: eRef.id,
    projectId,
    title: data.title,
    goal: data.goal,
    color: data.color ?? '#3B82F6',
    status: 'open',
    createdAt: now,
  };
  await setDoc(eRef, cleanForFirestore(newEpic));
  return { success: true, data: newEpic };
};

// ── Stories ───────────────────────────────────────────────────────────────────

export const getStories = async (projectId: string): Promise<ApiResponse<Story[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/projects/${projectId}/stories`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const q = query(collection(db, 'stories'), where('projectId', '==', projectId));
  const snap = await getDocs(q);
  const stories: Story[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      epicId: data.epicId,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      storyPoints: data.storyPoints ?? 0,
      priority: data.priority ?? 'medium',
      createdAt: data.createdAt ?? new Date().toISOString(),
    };
  });
  return { success: true, data: stories };
};

export const createStory = async (data: {
  projectId: string; epicId?: string; title: string; description?: string;
  storyPoints?: number; priority?: string;
}): Promise<ApiResponse<Story>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post('/stories', data);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const sRef = doc(collection(db, 'stories'));
  const now = new Date().toISOString();
  const newStory: Story = {
    id: sRef.id,
    projectId: data.projectId,
    epicId: data.epicId,
    title: data.title,
    description: data.description,
    storyPoints: data.storyPoints ?? 0,
    priority: (data.priority as Task['priority']) ?? 'medium',
    createdAt: now,
  };
  await setDoc(sRef, cleanForFirestore(newStory));
  return { success: true, data: newStory };
};

export const updateStory = async (storyId: string, data: Partial<Story>): Promise<ApiResponse<Story>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.patch(`/stories/${storyId}`, data);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const storyRef = doc(db, 'stories', storyId);
  await updateDoc(storyRef, cleanForFirestore(data));
  const snap = await getDoc(storyRef);
  return { success: true, data: { id: snap.id, ...snap.data() } as Story };
};

export const deleteStory = async (storyId: string): Promise<ApiResponse<void>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.delete(`/stories/${storyId}`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  await deleteDoc(doc(db, 'stories', storyId));
  return { success: true, data: undefined };
};

// ── Sprints ───────────────────────────────────────────────────────────────────

export const getProjectSprints = async (projectId: string): Promise<ApiResponse<Sprint[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/projects/${projectId}/sprints`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const q = query(collection(db, 'sprints'), where('projectId', '==', projectId));
  const snap = await getDocs(q);
  const sprints: Sprint[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      projectId: data.projectId,
      name: data.name,
      goal: data.goal,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status ?? 'planning',
      createdAt: data.createdAt ?? new Date().toISOString(),
    };
  });
  return { success: true, data: sprints };
};

export const createSprint = async (projectId: string, data: { name: string; goal?: string; startDate?: string; endDate?: string }): Promise<ApiResponse<Sprint>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post(`/projects/${projectId}/sprints`, data);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const spRef = doc(collection(db, 'sprints'));
  const now = new Date().toISOString();
  const newSprint: Sprint = {
    id: spRef.id,
    projectId,
    name: data.name,
    goal: data.goal,
    startDate: data.startDate,
    endDate: data.endDate,
    status: 'planning',
    createdAt: now,
  };
  await setDoc(spRef, cleanForFirestore(newSprint));
  return { success: true, data: newSprint };
};

export const getSprint = async (sprintId: string): Promise<ApiResponse<Sprint>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/sprints/${sprintId}`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const snap = await getDoc(doc(db, 'sprints', sprintId));
  if (!snap.exists()) return { success: false, error: { message: 'Sprint not found' } };
  return { success: true, data: { id: snap.id, ...snap.data() } as Sprint };
};

export const updateSprintStatus = async (sprintId: string, status: string): Promise<ApiResponse<Sprint>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.patch(`/sprints/${sprintId}/status`, { status });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const spRef = doc(db, 'sprints', sprintId);
  await updateDoc(spRef, { status });
  const snap = await getDoc(spRef);
  return { success: true, data: { id: snap.id, ...snap.data() } as Sprint };
};

export const getSprintBoard = async (sprintId: string): Promise<ApiResponse<{ items: SprintItem[]; tasks: Record<string, Task> }>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/sprints/${sprintId}/board`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const q = query(collection(db, 'sprint_items'), where('sprintId', '==', sprintId));
  const snap = await getDocs(q);
  const items: SprintItem[] = snap.docs.map((d, idx) => ({
    id: d.id,
    sprintId: d.data().sprintId,
    taskId: d.data().taskId,
    status: d.data().status ?? 'todo',
    orderIndex: d.data().orderIndex ?? idx,
  }));

  const tasksMap: Record<string, Task> = {};
  for (const item of items) {
    const taskDoc = await getDoc(doc(db, 'tasks', item.taskId));
    if (taskDoc.exists()) {
      tasksMap[item.taskId] = { id: taskDoc.id, ...taskDoc.data() } as Task;
    }
  }

  return { success: true, data: { items, tasks: tasksMap } };
};

export const addItemsToSprint = async (sprintId: string, taskIds: string[]): Promise<ApiResponse<SprintItem[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post(`/sprints/${sprintId}/items`, { taskIds });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const createdItems: SprintItem[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i];
    const itemRef = doc(collection(db, 'sprint_items'));
    const itemObj: SprintItem = {
      id: itemRef.id,
      sprintId,
      taskId,
      status: 'todo',
      orderIndex: i,
    };
    await setDoc(itemRef, cleanForFirestore(itemObj));
    createdItems.push(itemObj);

    const taskRef = doc(db, 'tasks', taskId);
    const tSnap = await getDoc(taskRef);
    if (tSnap.exists() && tSnap.data().status === 'backlog') {
      await updateDoc(taskRef, { status: 'todo', updatedAt: now });
    }
  }

  return { success: true, data: createdItems };
};

export const removeSprintItem = async (sprintId: string, taskId: string): Promise<ApiResponse<{ removed: boolean }>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.delete(`/sprints/${sprintId}/items/${taskId}`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const q = query(collection(db, 'sprint_items'), where('sprintId', '==', sprintId), where('taskId', '==', taskId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'sprint_items', d.id));
  }
  return { success: true, data: { removed: true } };
};

export const getBurndown = async (sprintId: string): Promise<ApiResponse<BurndownSnapshot[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/sprints/${sprintId}/burndown`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  return { success: true, data: [] };
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const createTask = async (data: {
  projectId: string; title: string; description?: string;
  priority?: string; estimateHours?: number; storyId?: string; assigneeId?: string;
  status?: string;
}): Promise<ApiResponse<Task>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post('/tasks', data);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const tRef = doc(collection(db, 'tasks'));
  const now = new Date().toISOString();
  const newTask: Task = {
    id: tRef.id,
    projectId: data.projectId,
    storyId: data.storyId,
    assigneeId: data.assigneeId,
    title: data.title,
    description: data.description,
    estimateHours: data.estimateHours ?? 0,
    priority: (data.priority as Task['priority']) ?? 'medium',
    status: (data.status as Task['status']) ?? 'backlog',
    labelIds: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(tRef, cleanForFirestore(newTask));
  return { success: true, data: newTask };
};

export const getTask = async (taskId: string): Promise<ApiResponse<Task & { subtasks: Subtask[]; comments: Comment[] }>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get(`/tasks/${taskId}`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const taskDoc = await getDoc(doc(db, 'tasks', taskId));
  if (!taskDoc.exists()) return { success: false, error: { message: 'Task not found' } };

  const taskData = { id: taskDoc.id, ...taskDoc.data() } as Task;

  const subSnap = await getDocs(query(collection(db, 'subtasks'), where('taskId', '==', taskId)));
  const subtasks: Subtask[] = subSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Subtask));

  const comSnap = await getDocs(query(collection(db, 'comments'), where('taskId', '==', taskId)));
  const comments: Comment[] = comSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));

  return { success: true, data: { ...taskData, subtasks, comments } };
};

export const getTasks = async (projectId: string, filter?: { status?: string; assigneeId?: string }): Promise<ApiResponse<Task[]>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.get('/tasks', { params: { projectId, ...filter } });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const constraints: any[] = [where('projectId', '==', projectId)];
  if (filter?.status) constraints.push(where('status', '==', filter.status));
  if (filter?.assigneeId) constraints.push(where('assigneeId', '==', filter.assigneeId));

  const q = query(collection(db, 'tasks'), ...constraints);
  const snap = await getDocs(q);
  const tasks: Task[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      projectId: data.projectId,
      storyId: data.storyId,
      assigneeId: data.assigneeId,
      title: data.title,
      description: data.description,
      estimateHours: data.estimateHours ?? 0,
      priority: data.priority ?? 'medium',
      status: data.status ?? 'backlog',
      labelIds: data.labelIds ?? [],
      version: data.version ?? 1,
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  });
  return { success: true, data: tasks };
};

export const updateTask = async (taskId: string, data: Partial<Task> & { version: number }): Promise<ApiResponse<Task>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.patch(`/tasks/${taskId}`, data);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const taskRef = doc(db, 'tasks', taskId);
  const now = new Date().toISOString();
  const updates = { ...data, version: data.version + 1, updatedAt: now };
  await updateDoc(taskRef, cleanForFirestore(updates));
  const snap = await getDoc(taskRef);
  return { success: true, data: { id: snap.id, ...snap.data() } as Task };
};

export const deleteTask = async (taskId: string): Promise<ApiResponse<void>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.delete(`/tasks/${taskId}`);
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  await deleteDoc(doc(db, 'tasks', taskId));
  return { success: true, data: undefined };
};

export const addComment = async (taskId: string, body: string): Promise<ApiResponse<Comment>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post(`/tasks/${taskId}/comments`, { body });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const cRef = doc(collection(db, 'comments'));
  const now = new Date().toISOString();
  const newComment: Comment = {
    id: cRef.id,
    entityType: 'task',
    entityId: taskId,
    userId: auth.currentUser?.uid ?? 'unknown',
    body,
    createdAt: now,
  };
  await setDoc(cRef, cleanForFirestore(newComment));
  return { success: true, data: newComment };
};

export const addSubtask = async (taskId: string, title: string): Promise<ApiResponse<Subtask>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.post(`/tasks/${taskId}/subtasks`, { title });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const subRef = doc(collection(db, 'subtasks'));
  const newSub: Subtask = {
    id: subRef.id,
    taskId,
    title,
    isDone: false,
    orderIndex: 0,
  };
  await setDoc(subRef, cleanForFirestore(newSub));
  return { success: true, data: newSub };
};

export const toggleSubtask = async (subtaskId: string, isDone: boolean): Promise<ApiResponse<Subtask>> => {
  if (!shouldUseDirectFirestore()) {
    try {
      const res = await apiClient.patch(`/tasks/subtasks/${subtaskId}/toggle`, { isDone });
      return res.data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const subRef = doc(db, 'subtasks', subtaskId);
  await updateDoc(subRef, { isDone });
  const snap = await getDoc(subRef);
  return { success: true, data: { id: snap.id, ...snap.data() } as Subtask };
};
