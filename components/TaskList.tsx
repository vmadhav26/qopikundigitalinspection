import React, { useState, useEffect, useCallback } from 'react';
import { Task } from '../types';
import { PlusCircleIcon, TrashIcon, ClipboardListIcon } from './icons';
import { getTasksForUser, addTask, updateTask, deleteTask } from '../data/db';

interface TaskListProps {
  userId: number;
}

const TaskList: React.FC<TaskListProps> = ({ userId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [loading, setLoading] = useState(true);

  // Load tasks from IndexedDB on mount
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const userTasks = await getTasksForUser(userId);
        setTasks(userTasks);
      } catch (error) {
        console.error("Failed to load tasks from database", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [userId]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim() === '') return;
    const newTaskData = {
      userId,
      text: newTaskText.trim(),
      completed: false,
    };
    const addedTask = await addTask(newTaskData);
    setTasks(prevTasks => [...prevTasks, addedTask]);
    setNewTaskText('');
  };

  const handleToggleTask = useCallback(async (id: number) => {
    const taskToToggle = tasks.find(task => task.id === id);
    if (!taskToToggle) return;

    const newCompletedStatus = !taskToToggle.completed;
    await updateTask(id, { completed: newCompletedStatus });
    
    setTasks(currentTasks => currentTasks.map(task =>
      task.id === id ? { ...task, completed: newCompletedStatus } : task
    ));
  }, [tasks]);

  const handleDeleteTask = useCallback(async (id: number) => {
    await deleteTask(id);
    setTasks(currentTasks => currentTasks.filter(task => task.id !== id));
  }, []);

  return (
    <div className="bg-gray-800 p-6 rounded-lg h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <ClipboardListIcon className="w-6 h-6 text-cyan-400" />
        My Tasks
      </h2>
      <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTaskText}
          onChange={e => setNewTaskText(e.target.value)}
          placeholder="Add a new task..."
          className="flex-grow bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500 text-sm p-2"
        />
        <button
          type="submit"
          className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white transition-colors flex-shrink-0"
          aria-label="Add Task"
        >
          <PlusCircleIcon className="w-5 h-5" />
        </button>
      </form>
      <div className="flex-grow overflow-y-auto space-y-2 pr-2 -mr-2">
        {loading ? (
           <div className="flex items-center justify-center h-full">
            <p className="text-center text-gray-500 py-4">Loading tasks...</p>
          </div>
        ) : tasks.length > 0 ? (
          tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-md"
            >
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => handleToggleTask(task.id!)}
                className="w-5 h-5 rounded bg-gray-600 border-gray-500 text-cyan-500 focus:ring-cyan-600 cursor-pointer flex-shrink-0"
              />
              <span
                className={`flex-grow text-sm break-words ${
                  task.completed ? 'line-through text-gray-500' : 'text-gray-300'
                }`}
              >
                {task.text}
              </span>
              <button
                onClick={() => handleDeleteTask(task.id!)}
                className="text-gray-500 hover:text-red-400 transition-colors ml-auto flex-shrink-0"
                aria-label="Delete Task"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-center text-gray-500 py-4">No tasks yet. Add one above!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;