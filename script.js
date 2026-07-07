const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');

// Read saved tasks from localStorage.
function getTasksFromStorage() {
  return JSON.parse(localStorage.getItem('tasks')) || [];
}

// Save current list items back to localStorage.
function saveTasksToStorage() {
  const tasks = [];
  const items = todoList.querySelectorAll('li');

  items.forEach((item) => {
    const taskText = item.querySelector('span').textContent;
    const completed = item.querySelector('input[type="checkbox"]').checked;
    tasks.push({ text: taskText, completed: completed });
  });
   function renderTasks() {
      const list = document.getElementById('taskList');
      list.innerHTML = '';
      tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${task.name}</strong> <button onclick="addSubtask(${index})">Add Subtask</button>`;
        list.appendChild(li);
        task.subtasks.forEach(subtask => {
          const subli = document.createElement('li');
          subli.textContent = subtask;
          li.appendChild(subli);
        });
      });
    }

function renderTasks() {
  taskList.innerHTML = "";

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item";
    li.dataset.taskId = task.id;
    li.dataset.category = task.category;

    if (task.completed) li.classList.add("completed");

    let dueDateHTML = "";
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isOverdue = dueDate < today && !task.completed;
      const dateClass = isOverdue ? "overdue" : "";

      const options = { month: "short", day: "numeric", year: "numeric" };
      const formattedDate = dueDate.toLocaleDateString("en-US", options);

      dueDateHTML = `<span class="task-due-date ${dateClass}">📅 ${formattedDate}</span>`;
    }
  li.innerHTML = `
      <div class="task-header">
          <span class="task-text">${escapeHtml(task.text)}</span>
          <div class="task-meta">
              <span class="task-category">${task.category}</span>
              ${dueDateHTML}
          </div>
      </div>
      <div class="task-actions">
          <button class="complete-btn" onclick="toggleComplete(${task.id})">
              ${task.completed ? "↶ Undo" : "✓ Complete"}
          </button>
          <button class="edit-btn" onclick="openEditModal(${
            task.id
          })">✎ Edit</button>
          <button class="delete-btn" onclick="deleteTask(${
            task.id
          })">✕ Delete</button>
      </div>
    `;

    taskList.appendChild(li);
  });

  filterTasks(currentFilter);
}


  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Create one task row and wire up its controls.
function addTask(taskData) {
  const task = typeof taskData === 'string' ? { text: taskData, completed: false } : taskData;

  const listItem = document.createElement('li');
  listItem.classList.add('todo-item');

  const checkBox = document.createElement('input');
  checkBox.type = 'checkbox';
  checkBox.checked = task.completed;
  listItem.appendChild(checkBox);

  const taskText = document.createElement('span');
  taskText.textContent = task.text;
  taskText.style.textDecoration = task.completed ? 'line-through' : 'none';
  listItem.appendChild(taskText);

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = '\u{1F58A}\u{FE0F}';
  editButton.classList.add('task-action-btn');
  editButton.title = 'Edit task';
  editButton.setAttribute('aria-label', 'Edit task');

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = '\u{1F5D1}\u{FE0F}';
  deleteButton.classList.add('task-action-btn');
  deleteButton.title = 'Delete task';
  deleteButton.setAttribute('aria-label', 'Delete task');

  const actionGroup = document.createElement('div');
  actionGroup.classList.add('task-actions');
  actionGroup.appendChild(editButton);
  actionGroup.appendChild(deleteButton);
  listItem.appendChild(actionGroup);

  // Toggle completed state.
  checkBox.addEventListener('change', function () {
    taskText.style.textDecoration = this.checked ? 'line-through' : 'none';
    saveTasksToStorage();
  });

  // Switch between Edit and Save mode for this task.
  editButton.addEventListener('click', function () {
    const existingInput = listItem.querySelector('input[type="text"]');

    if (existingInput) {
      const updatedText = existingInput.value.trim();
      if (updatedText === '') {
        alert('Task cannot be empty.');
        return;
      }

      taskText.textContent = updatedText;
      listItem.replaceChild(taskText, existingInput);
      editButton.textContent = '\u{1F58A}\u{FE0F}';
      editButton.title = 'Edit task';
      editButton.setAttribute('aria-label', 'Edit task');
      saveTasksToStorage();
      return;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.value = taskText.textContent;
    listItem.replaceChild(input, taskText);
    editButton.textContent = 'Save';
    editButton.title = 'Save task';
    editButton.setAttribute('aria-label', 'Save task');
    input.focus();
  });

  // Remove task from the list.
  deleteButton.addEventListener('click', function () {
    todoList.removeChild(listItem);
    saveTasksToStorage();
  });

  todoList.appendChild(listItem);
}

// Add a new task from the form input.
todoForm.addEventListener('submit', function (event) {
  event.preventDefault();
  const newTask = todoInput.value.trim();

  if (newTask === '') {
    alert('Please enter a task!');
    return;
  }

  addTask({ text: newTask, completed: false });
  saveTasksToStorage();
  todoInput.value = '';
});

// Restore saved tasks when the page first loads.
document.addEventListener('DOMContentLoaded', function () {
  const savedTasks = getTasksFromStorage();
  savedTasks.forEach((task) => addTask(task));
});