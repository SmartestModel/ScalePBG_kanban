import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Task, BoardColumn as BoardColumnType, BOARD_COLUMNS, TaskStatus, OrgMember } from '../../types';
import { useBoardStore } from '../../store/useBoardStore';
import { Column } from './Column';
import { CardDetailModal } from './CardDetailModal';
import { TaskCard } from './TaskCard';
import { Modal } from '../common/Modal';
import { createTask } from '../../services/api';

interface BoardProps {
  projectId: string;
  sprintId?: string;
  members: OrgMember[];
  viewFilter?: 'all' | 'my-tasks';
  currentUserId?: string;
}

export const Board: React.FC<BoardProps> = ({
  projectId,
  sprintId,
  members,
  viewFilter = 'all',
  currentUserId,
}) => {
  const tasks = useBoardStore((s) => s.tasks);
  const moveTask = useBoardStore((s) => s.moveTask);
  const setActiveDrag = useBoardStore((s) => s.setActiveDrag);
  const activeDragId = useBoardStore((s) => s.activeDragId);
  const upsertTask = useBoardStore((s) => s.upsertTask);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createColumn, setCreateColumn] = useState<TaskStatus>('todo');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const memberNames = Object.fromEntries(members.map((m) => [m.uid, m.name ?? m.email ?? m.uid]));
  const memberAvatars = Object.fromEntries(members.map((m) => [m.uid, m.avatarUrl ?? '']));

  // Filter tasks
  const allTasks = Object.values(tasks).filter((t) => t.projectId === projectId);
  const filteredTasks =
    viewFilter === 'my-tasks' && currentUserId
      ? allTasks.filter((t) => t.assigneeId === currentUserId)
      : allTasks;

  const getColumnTasks = (status: TaskStatus) =>
    filteredTasks
      .filter((t) => t.status === status)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks[event.active.id as string];
    setActiveTask(task ?? null);
    setActiveDrag(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveDrag(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // overId is either a column status or another task id
    const targetStatus = (
      BOARD_COLUMNS.some((c) => c.id === overId)
        ? overId
        : tasks[overId]?.status
    ) as TaskStatus | undefined;

    if (!targetStatus) return;

    try {
      await moveTask(taskId, targetStatus);
    } catch (err: unknown) {
      const e = err as { type?: string; message?: string };
      if (e.type === 'CONFLICT') {
        setConflictMsg('Another user changed this task. The board has been refreshed.');
      }
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setCreateLoading(true);
    try {
      const res = await createTask({
        projectId,
        title: newTaskTitle.trim(),
        status: createColumn,
      });
      if (res.success && res.data) {
        upsertTask(res.data);
        setNewTaskTitle('');
        setCreateModalOpen(false);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Board topbar */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {filteredTasks.length} tasks
          {viewFilter === 'my-tasks' && ' (yours)'}
        </span>
        <button
          id="board-add-task"
          className="btn btn-primary btn-sm"
          onClick={() => { setCreateColumn('todo'); setCreateModalOpen(true); }}
        >
          <Plus size={14} />
          Add Task
        </button>
      </div>

      {/* Conflict banner */}
      {conflictMsg && (
        <div className="alert alert-error" style={{ margin: '0 20px', marginTop: 12 }}>
          ⚠ {conflictMsg}
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => setConflictMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Board columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="board-container">
          {BOARD_COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              tasks={getColumnTasks(col.id)}
              memberNames={memberNames}
              memberAvatars={memberAvatars}
              onTaskClick={(task) => setSelectedTaskId(task.id)}
              onAddTask={() => {
                setCreateColumn(col.id);
                setCreateModalOpen(true);
              }}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              assigneeName={activeTask.assigneeId ? memberNames[activeTask.assigneeId] : undefined}
              assigneeAvatar={activeTask.assigneeId ? memberAvatars[activeTask.assigneeId] : undefined}
              onClick={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Task detail modal */}
      <CardDetailModal
        taskId={selectedTaskId}
        members={members}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* Create task modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Task"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button
              id="create-task-submit"
              className="btn btn-primary"
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim() || createLoading}
            >
              {createLoading ? 'Creating...' : 'Create Task'}
            </button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">Task Title</label>
          <input
            id="new-task-title"
            className="input"
            placeholder="What needs to be done?"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            autoFocus
          />
        </div>
        <div className="input-group" style={{ marginTop: 12 }}>
          <label className="input-label">Starting Column</label>
          <select
            id="new-task-column"
            className="input"
            value={createColumn}
            onChange={(e) => setCreateColumn(e.target.value as TaskStatus)}
          >
            {BOARD_COLUMNS.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
};
