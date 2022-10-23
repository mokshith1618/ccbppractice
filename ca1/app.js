const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const format = require("date-fns/format");
const isValid = require("date-fns/isValid");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "todoApplication.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
const invalidityConditions = (status, priority, category, dueDate, date) => {
  if (!["HIGH", "MEDIUM", "", "LOW"].includes(priority)) {
    return "Invalid Todo Priority";
  } else if (!["TO DO", "IN PROGRESS", "", "DONE"].includes(status)) {
    return "Invalid Todo Status";
  } else if (!["WORK", "HOME", "", "LEARNING"].includes(category)) {
    return "Invalid Todo Category";
  } else if (!isValid(new Date(dueDate)) && !dueDate == "") {
    return "Invalid Due Date";
  } else if (!isValid(new Date(date)) && !date == "") {
    return "Invalid Due Date";
  }
  return "valid";
};
const formattedTodosList = (todo) => {
  return {
    id: todo.id,
    todo: todo.todo,
    priority: todo.priority,
    status: todo.status,
    category: todo.category,
    dueDate: todo.due_date,
  };
};
const checkValidity = (request, response, next) => {
  let res = 0;
  for (let obj of [request.body, request.query]) {
    let {
      category = "",
      status = "",
      dueDate = "",
      priority = "",
      date = "",
    } = obj;
    const validity = invalidityConditions(
      status,
      priority,
      category,
      dueDate,
      date
    );
    if (validity !== "valid") {
      response.status(400);
      response.send(validity);
      res = 1;
      break;
    }
  }
  if (res === 0) {
    next();
  }
};
app.get("/todos/", checkValidity, async (request, response) => {
  const {
    search_q = "",
    category = "",
    status = "",
    priority = "",
  } = request.query;
  const getTodosQuery = `
    SELECT 
        *
    FROM 
        todo
    WHERE 
       ( todo LIKE '%${search_q}%' and
        category LIKE '%${category}%' and
        status LIKE '%${status}%' and
        priority LIKE '%${priority}%');`;
  const todos = await db.all(getTodosQuery);
  response.send(todos.map((item) => formattedTodosList(item)));
});
app.get("/todos/:todoId/", checkValidity, async (request, response) => {
  const { todoId } = request.params;
  const getTodoQuery = `
    SELECT 
        *
    FROM 
        todo
    WHERE 
        id=${todoId};`;
  const todo = await db.get(getTodoQuery);
  response.send(formattedTodosList(todo));
});
app.get("/agenda/", checkValidity, async (request, response) => {
  const { date = "" } = request.query;
  let formattedDueDate = "";
  if (date !== "") {
    formattedDueDate = format(new Date(date), "yyyy-MM-dd");
  }
  const getTodosQuery = `
    SELECT 
         *
    FROM 
        todo
    WHERE
        strftime('%Y-%m-%d',due_date) LIKE '%${formattedDueDate}%';`;
  const todos = await db.all(getTodosQuery);
  response.send(todos.map((item) => formattedTodosList(item)));
});
app.post("/todos/", checkValidity, async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;
  const formattedDueDate = format(new Date(dueDate), "yyyy-MM-dd");
  const postTodoQuery = `
    INSERT INTO 
        todo(id,todo,priority,status,category,due_date)
    VALUES 
        (${id},'${todo}','${priority}','${status}','${category}','${formattedDueDate}');`;
  const dbResponse = await db.run(postTodoQuery);
  response.send("Todo Successfully Added");
});
app.delete("/todos/:todoId/", checkValidity, async (request, response) => {
  const { todoId } = request.params;
  const deleteTodoQuery = `
    DELETE FROM todo
    WHERE 
        id=${todoId};`;
  const dbResponse = await db.run(deleteTodoQuery);
  response.send("Todo Deleted");
});
app.put("/todos/:todoId/", checkValidity, async (request, response) => {
  const { todoId } = request.params;
  `sptcd`;
  let col;
  if (request.body.status !== undefined) {
    col = "Status";
  } else if (request.body.priority !== undefined) {
    col = "Priority";
  } else if (request.body.todo !== undefined) {
    col = "Todo";
  } else if (request.body.category !== undefined) {
    col = "Category";
  } else if (request.body.dueDate !== undefined) {
    col = "Due Date";
  }
  const selectTodoQuery = `
    SELECT 
        *
    FROM 
        todo
    WHERE 
       id=${todoId} ;`;
  const previousTodo = await db.get(selectTodoQuery);
  const {
    todo = previousTodo.todo,
    category = previousTodo.category,
    priority = previousTodo.priority,
    status = previousTodo.status,
    dueDate = previousTodo.due_date,
  } = request.body;
  const formattedDueDate = format(new Date(dueDate), "yyyy-MM-dd");
  const putTodoQuery = `
    UPDATE todo
    SET 
        id=${todoId},
        todo='${todo}',
        category='${category}',
        priority='${priority}',
        status='${status}',
        due_date='${formattedDueDate}';`;
  const dbResponse = await db.run(putTodoQuery);
  response.send(`${col} Updated`);
});
module.exports = app;
