import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, AlertTriangle } from 'lucide-react';
import { Task, BoardColumn as BoardColumnType, Epic, Story } from '../../types';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  column: BoardColumnType;
  tasks: Task[];
  memberNames: Record<string, string>;
  memberAvatars: Record<string, string>;
  epicsMap?: Record<string, Epic>;
  storiesMap?: Record<string, Story>;
  onTaskClick: (task: Task) => void;
  onAddTask?: () => void;
}

export const Column: React.FC<ColumnProps> = ({
  column,
  tasks,
  memberNames,
  memberAvatars,
  epicsMap = {},
  storiesMap = {},
  onTaskClick,
  onAddTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const isOverWip =
    column.wipLimit && column.wipLimit > 0 && tasks.length > column.wipLimit;

  return (
    <div
      className={`kanban-column ${isOver ? 'drag-over' : ''}`}
    >
      {/* Column header */}
      <div className="kanban-column-header">
        <div className="kanban-column-title">
          <div
            className="column-dot"
            style={{ background: column.color }}
          />
          {column.title}
          <span className="column-count">{tasks.length}</span>
          {isOverWip && (
            <span className="column-wip-warning" title={`WIP limit: ${column.wipLimit}`}>
              <AlertTriangle size={12} />
            </span>
          )}
        </div>

        {onAddTask && (
          <button
            id={`add-task-${column.id}`}
            className="btn btn-ghost btn-icon"
            onClick={onAddTask}
            title="Add task"
            style={{ width: 26, height: 26, padding: 0 }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* WIP warning banner */}
      {isOverWip && (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 11,
            color: 'var(--priority-urgent)',
            background: 'hsla(345, 85%, 62%, 0.08)',
            borderBottom: '1px solid hsla(345, 85%, 62%, 0.15)',
          }}
        >
          WIP limit exceeded ({tasks.length}/{column.wipLimit})
        </div>
      )}

      {/* Task list */}
      <SortableContext
        id={column.id}
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="kanban-column-body">
          {tasks.length === 0 && (
            <div
              style={{
                padding: '20px 8px',
                textAlign: 'center',
                color: 'var(--text-disabled)',
                fontSize: 12,
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                margin: 4,
              }}
            >
              Drop tasks here
            </div>
          )}
          {tasks.map((task) => {
            const story = task.storyId ? storiesMap[task.storyId] : undefined;
            const epic = story?.epicId ? epicsMap[story.epicId] : undefined;
            return (
              <TaskCard
                key={task.id}
                task={task}
                assigneeName={task.assigneeId ? memberNames[task.assigneeId] : undefined}
                assigneeAvatar={task.assigneeId ? memberAvatars[task.assigneeId] : undefined}
                epicTitle={epic?.title}
                epicColor={epic?.color}
                storyTitle={story?.title}
                onClick={onTaskClick}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
};
