/** @jest-environment jsdom */

function setupDom() {
  document.body.innerHTML = `
    <div id="todo-app">
      <h1>My To-Do List</h1>
      <form id="todo-form">
        <input type="text" id="todo-input" placeholder="Add a new task...">
        <input type="date" id="todo-due-date" aria-label="Task due date">
        <button type="submit">Add Task</button>
      </form>
      <ul id="todo-list"></ul>
    </div>
  `;
}

function loadApp(initialTasks = []) {
  jest.resetModules();
  localStorage.clear();
  localStorage.setItem('tasks', JSON.stringify(initialTasks));
  setupDom();
  window.alert = jest.fn();
  window.prompt = jest.fn();
  require('./script.js');
}

function submitTask(text, dueDate = '') {
  const form = document.getElementById('todo-form');
  const input = document.getElementById('todo-input');
  const dueDateInput = document.getElementById('todo-due-date');

  input.value = text;
  dueDateInput.value = dueDate;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function storedTasks() {
  return JSON.parse(localStorage.getItem('tasks') || '[]');
}

describe('to-do app behavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  test('loads saved tasks from localStorage and shows due dates', () => {
    loadApp([
      {
        id: 'task-1',
        text: 'Saved task',
        completed: false,
        dueDate: '2026-07-20',
        subtasks: []
      }
    ]);

    expect(document.querySelector('.task-title').textContent).toBe('Saved task');
    expect(document.querySelector('.task-due-date').textContent).toContain('Due:');
  });

  test('adds a task and saves it to localStorage', () => {
    loadApp();

    submitTask('Read chapter', '2026-07-21');

    expect(document.querySelectorAll('#todo-list > li')).toHaveLength(1);
    expect(document.querySelector('.task-title').textContent).toBe('Read chapter');
    expect(storedTasks()).toEqual([
      expect.objectContaining({
        text: 'Read chapter',
        completed: false,
        dueDate: '2026-07-21',
        subtasks: []
      })
    ]);
  });

  test('edits a task and persists the updated text', () => {
    loadApp([
      { id: 'task-1', text: 'Old task', completed: false, dueDate: '', subtasks: [] }
    ]);
    window.prompt.mockReturnValue('Updated task');

    document.querySelector('button[aria-label="Edit task"]').click();

    expect(document.querySelector('.task-title').textContent).toBe('Updated task');
    expect(storedTasks()[0].text).toBe('Updated task');
  });

  test('deletes a task and removes it from localStorage', () => {
    loadApp([
      { id: 'task-1', text: 'Keep', completed: false, dueDate: '', subtasks: [] },
      { id: 'task-2', text: 'Remove me', completed: false, dueDate: '', subtasks: [] }
    ]);

    const deleteButtons = document.querySelectorAll('button[aria-label="Delete task"]');
    deleteButtons[1].click();

    expect(document.querySelectorAll('#todo-list > li')).toHaveLength(1);
    expect(document.querySelector('.task-title').textContent).toBe('Keep');
    expect(storedTasks().map((task) => task.text)).toEqual(['Keep']);
  });

  test('marks tasks complete and saves the completed state', () => {
    loadApp([
      {
        id: 'task-1',
        text: 'Finish homework',
        completed: false,
        dueDate: '2026-07-22',
        subtasks: []
      }
    ]);

    const checkbox = document.querySelector('#todo-list input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(storedTasks()[0].completed).toBe(true);
    expect(document.querySelector('.task-title').style.textDecoration).toBe('line-through');
  });

  test('adds a subtask and keeps it in localStorage', () => {
    loadApp([
      { id: 'task-1', text: 'Main task', completed: false, dueDate: '', subtasks: [] }
    ]);
    window.prompt.mockReturnValue('First subtask');

    document.querySelector('.add-subtask-btn').click();

    expect(document.querySelector('.task-subtask').textContent).toBe('First subtask');
    expect(storedTasks()[0].subtasks).toEqual(['First subtask']);
  });

  test('reorders tasks and persists the new order', () => {
    loadApp([
      { id: 'task-1', text: 'Task A', completed: false, dueDate: '', subtasks: [] },
      { id: 'task-2', text: 'Task B', completed: false, dueDate: '', subtasks: [] },
      { id: 'task-3', text: 'Task C', completed: false, dueDate: '', subtasks: [] }
    ]);

    const taskRows = Array.from(document.querySelectorAll('#todo-list > li'));
    const moveUpTaskC = taskRows[2].querySelector('button[aria-label="Move task up"]');
    moveUpTaskC.click();

    expect(Array.from(document.querySelectorAll('.task-title')).map((node) => node.textContent)).toEqual([
      'Task A',
      'Task C',
      'Task B'
    ]);
    expect(storedTasks().map((task) => task.text)).toEqual(['Task A', 'Task C', 'Task B']);
  });
});