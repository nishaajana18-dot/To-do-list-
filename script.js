const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoDueDate = document.getElementById('todo-due-date');
const todoList = document.getElementById('todo-list');

let tasks = loadTasks();

function loadTasks() {
  const raw = JSON.parse(localStorage.getItem('tasks')) || [];
  return raw.map((task, index) => ({
    id: task.id || `${Date.now()}-${index}`,
    text: task.text || '',
    completed: Boolean(task.completed),
    dueDate: task.dueDate || '',
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
  }));
}

function saveTasksToStorage() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function moveTask(taskId, direction) {
  const currentIndex = tasks.findIndex((task) => task.id === taskId);
  if (currentIndex === -1) {
    return;
  }

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= tasks.length) {
    return;
  }

  const [taskToMove] = tasks.splice(currentIndex, 1);
  tasks.splice(targetIndex, 0, taskToMove);
  saveTasksToStorage();
  renderTasks();
}

function formatDueDate(dueDateValue) {
  if (!dueDateValue) {
    return '';
  }

  const date = new Date(`${dueDateValue}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) {
    return false;
  }

  const due = new Date(`${task.dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function renderTasks() {
  todoList.innerHTML = '';

  tasks.forEach((task, index) => {
    const listItem = document.createElement('li');
    listItem.classList.add('todo-item');
    listItem.dataset.taskId = task.id;

    const checkBox = document.createElement('input');
    checkBox.type = 'checkbox';
    checkBox.checked = task.completed;
    checkBox.addEventListener('change', () => {
      task.completed = checkBox.checked;
      saveTasksToStorage();
      renderTasks();
    });

    const main = document.createElement('div');
    main.classList.add('task-main');

    const taskTitle = document.createElement('span');
    taskTitle.classList.add('task-title');
    taskTitle.textContent = task.text;
    taskTitle.style.textDecoration = task.completed ? 'line-through' : 'none';
    main.appendChild(taskTitle);

    if (task.dueDate) {
      const dueDate = document.createElement('span');
      dueDate.classList.add('task-due-date');
      if (isOverdue(task)) {
        dueDate.classList.add('overdue');
      }
      dueDate.textContent = `Due: ${formatDueDate(task.dueDate)}`;
      main.appendChild(dueDate);
    }

    const subtaskList = document.createElement('ul');
    subtaskList.classList.add('task-subtasks');
    task.subtasks.forEach((subtask) => {
      const subtaskItem = document.createElement('li');
      subtaskItem.classList.add('task-subtask');
      subtaskItem.textContent = subtask;
      subtaskList.appendChild(subtaskItem);
    });

    if (task.subtasks.length > 0) {
      main.appendChild(subtaskList);
    }

    const addSubtaskButton = document.createElement('button');
    addSubtaskButton.type = 'button';
    addSubtaskButton.classList.add('add-subtask-btn');
    addSubtaskButton.textContent = '+ Subtask';
    addSubtaskButton.addEventListener('click', () => {
      const value = prompt('Enter a subtask:');
      const subtaskText = value ? value.trim() : '';
      if (!subtaskText) {
        return;
      }

      task.subtasks.push(subtaskText);
      saveTasksToStorage();
      renderTasks();
    });
    main.appendChild(addSubtaskButton);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = '\u{1F58A}\u{FE0F}';
    editButton.classList.add('task-action-btn');
    editButton.title = 'Edit task';
    editButton.setAttribute('aria-label', 'Edit task');
    editButton.addEventListener('click', () => {
      const updated = prompt('Edit task:', task.text);
      const updatedText = updated ? updated.trim() : '';
      if (!updatedText) {
        return;
      }

      task.text = updatedText;
      saveTasksToStorage();
      renderTasks();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '\u{1F5D1}\u{FE0F}';
    deleteButton.classList.add('task-action-btn');
    deleteButton.title = 'Delete task';
    deleteButton.setAttribute('aria-label', 'Delete task');
    deleteButton.addEventListener('click', () => {
      tasks = tasks.filter((item) => item.id !== task.id);
      saveTasksToStorage();
      renderTasks();
    });

    const moveUpButton = document.createElement('button');
    moveUpButton.type = 'button';
    moveUpButton.textContent = '\u{2B06}\u{FE0F}';
    moveUpButton.classList.add('task-action-btn', 'reorder-btn');
    moveUpButton.title = 'Move task up';
    moveUpButton.setAttribute('aria-label', 'Move task up');
    moveUpButton.disabled = index === 0;
    moveUpButton.addEventListener('click', () => {
      moveTask(task.id, -1);
    });

    const moveDownButton = document.createElement('button');
    moveDownButton.type = 'button';
    moveDownButton.textContent = '\u{2B07}\u{FE0F}';
    moveDownButton.classList.add('task-action-btn', 'reorder-btn');
    moveDownButton.title = 'Move task down';
    moveDownButton.setAttribute('aria-label', 'Move task down');
    moveDownButton.disabled = index === tasks.length - 1;
    moveDownButton.addEventListener('click', () => {
      moveTask(task.id, 1);
    });

    const actionGroup = document.createElement('div');
    actionGroup.classList.add('task-actions');
    actionGroup.appendChild(moveUpButton);
    actionGroup.appendChild(moveDownButton);
    actionGroup.appendChild(editButton);
    actionGroup.appendChild(deleteButton);

    listItem.appendChild(checkBox);
    listItem.appendChild(main);
    listItem.appendChild(actionGroup);
    todoList.appendChild(listItem);
  });
}

todoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = todoInput.value.trim();

  if (!text) {
    alert('Please enter a task!');
    return;
  }

  const newTask = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    completed: false,
    dueDate: todoDueDate.value || '',
    subtasks: []
  };

  tasks.push(newTask);
  saveTasksToStorage();
  renderTasks();

  todoInput.value = '';
  todoDueDate.value = '';
});

renderTasks();