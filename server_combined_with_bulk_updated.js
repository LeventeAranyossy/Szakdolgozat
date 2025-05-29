
const express = require('express');
const http = require('http');
const { exec } = require('child_process');
const bodyParser = require('body-parser');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');
const quizRooms = {}; // { roomCode: { teacherSocket, students: [], questions: [], scores: {} } }
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'codeassist',
  password: 'Loha5zaroF',
  port: 9000,
});
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));app.use(fileUpload());
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'A fájl nem található.' });
  }

  res.download(filePath);
});

app.use(
  session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: true,
  })
);
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}
app.get('/', (req, res) => {
  res.redirect('/try');
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public','views', 'login.html'));
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (user.rows.length > 0) {
      req.session.user = user.rows[0];
      return res.json({
        success: true,
        redirect: user.rows[0].role === 'teacher' ? '/teacher' : '/student'
      });
    }
     else {
      return res.json({ success: false, message: "❌ Hibás e-mail vagy jelszó! Kérjük, próbáld újra." });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Internal server error.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.send('Error logging out');
    res.redirect('/login');
  });
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'register.html'));
});

app.post('/register', async (req, res) => {
  const { email, password, role, vorname, surname } = req.body;

  try {
    await pool.query(
      'INSERT INTO users (email, password, role, vorname, surname) VALUES ($1, $2, $3, $4, $5)',
      [email, password, role, vorname, surname]
    );
    res.json({ success: true, message: "✅ Sikeres regisztráció! Most már bejelentkezhetsz." });

  } catch (error) {
    if (error.code === '23505') {
      return res.json({ success: false, message: "❌ Az e-mail cím már foglalt! Próbálj meg egy másikat." });
    }

    console.error('❌ Registration error:', error);
    res.status(500).json({ success: false, message: "❌ Ismeretlen hiba történt a regisztráció során." });
  }
});

app.get('/teacher/student-tasks/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const tasks = await pool.query(`
      SELECT name, student_upload, grade, feedback
      FROM tasks
      WHERE student_id = $1 AND teacher_id = $2
      ORDER BY id ASC -- vagy created_at, ha van timestamp oszlopod
    `, [id, req.session.user.id]);
    res.json(tasks.rows);
  } catch (error) {
    console.error('Error fetching student tasks:', error);
    res.status(500).json({ error: 'Hiba a lekérdezés során.' });
  }
});


app.get('/teacher', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'teacher') return res.send('Unauthorized');
  res.sendFile(path.join(__dirname, 'public', 'views', 'teacher.html'));
});
app.get('/teacher/students', isAuthenticated, async (req, res) => {
  try {
    const students = await pool.query("SELECT id, vorname, surname FROM users WHERE role = 'student'");
    res.json(students.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).send('Internal server error');
  }
});
app.post('/teacher/tasks', isAuthenticated, async (req, res) => {
  try {
    const { taskName, description, studentIds } = req.body;
    if (!taskName || !description || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).send('Task name, description, and at least one student are required.');
    }
const duplicate = await pool.query(
  'SELECT 1 FROM tasks WHERE teacher_id = $1 AND name = $2 LIMIT 1',
  [req.session.user.id, taskName]
);
if (duplicate.rowCount > 0) {
  return res.status(400).json({ message: '❌ Már létezik ilyen nevű feladat.' });
}


    for (const studentId of studentIds) {
      await pool.query(
        'INSERT INTO tasks (teacher_id, student_id, name, description) VALUES ($1, $2, $3, $4)',
        [req.session.user.id, studentId, taskName, description]
      );
    }
    res.json({ message: 'Task assigned successfully.' });
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).send('Internal server error.');
  }
});

app.get('/teacher/info', isAuthenticated, (req, res) => {
  if (req.session.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  res.json({ vorname: req.session.user.vorname });
});
app.get('/teacher/tasks/list', isAuthenticated, async (req, res) => {
  try {
    const tasks = await pool.query(
      `SELECT name, MIN(id) as id
       FROM tasks
       WHERE teacher_id = $1
       GROUP BY name`,
      [req.session.user.id]
    );
    if (!tasks.rows || tasks.rows.length === 0) {
      return res.status(404).json({ error: 'No tasks found.' });
    }
    res.json(tasks.rows);
  } catch (error) {
    console.error('Error fetching task list:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});
app.get('/teacher/submissions/:taskId', isAuthenticated, async (req, res) => {
  const { taskId } = req.params;
  if (!taskId || isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID.' });
  }
  try {
    const submissions = await pool.query(
      `SELECT tasks.id AS task_id,
              tasks.student_id,
              CONCAT(users.vorname, ' ', users.surname) AS student_name,
              tasks.student_upload,
              tasks.feedback,
              tasks.grade
       FROM tasks
       JOIN users ON tasks.student_id = users.id
       WHERE tasks.name = (
         SELECT name FROM tasks WHERE id = $1
       )
       AND tasks.teacher_id = $2`,
      [taskId, req.session.user.id]
    );
    if (!submissions.rows || submissions.rows.length === 0) {
      return res.status(404).json({ error: 'No submissions found for this task.' });
    }
    res.json(submissions.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});
app.post('/teacher/feedback', isAuthenticated, async (req, res) => {
  const { taskId, studentId, grade, feedback } = req.body;
  if (!taskId || !studentId || !grade || !feedback) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const result = await pool.query(
      'UPDATE tasks SET grade = $1, feedback = $2 WHERE id = $3 AND student_id = $4',
      [grade, feedback, taskId, studentId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task or student not found.' });
    }
    res.json({ message: 'Feedback submitted successfully.' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});
app.post('/teacher/feedback/bulk', isAuthenticated, async (req, res) => {
  const { feedbacks } = req.body;
  if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
    return res.status(400).json({ error: 'Invalid feedback data.' });
  }

  try {
    for (const fb of feedbacks) {
      const numericGrade = parseInt(fb.grade);
      if (!fb.taskId || !fb.studentId || isNaN(numericGrade) || !fb.feedback) continue;

      await pool.query(
        'UPDATE tasks SET grade = $1, feedback = $2 WHERE id = $3 AND student_id = $4',
        [numericGrade, fb.feedback, fb.taskId, fb.studentId]
      );
    }
    res.json({ message: 'Minden értékelés sikeresen mentve.' });
  } catch (error) {
    console.error('Bulk feedback error:', error);
    res.status(500).json({ error: 'Szerverhiba mentés közben.' });
  }
});
app.get('/student', isAuthenticated, async (req, res) => {
  if (req.session.user.role !== 'student') return res.status(403).send('Unauthorized');
  res.sendFile(path.join(__dirname, 'public', 'views', 'student.html'));
});

app.post('/student/tasks', isAuthenticated, async (req, res) => {
  try {
    const tasks = await pool.query(`
      SELECT 
        tasks.*, 
        CONCAT(u.vorname, ' ', u.surname) AS teacher_name
      FROM tasks
      JOIN users u ON tasks.teacher_id = u.id
      WHERE tasks.student_id = $1
    `, [req.session.user.id]);
    res.json(tasks.rows);
  } catch (error) {
    console.error('Error fetching student tasks:', error);
    res.status(500).send('Internal server error');
  }
});

app.post('/student/upload', isAuthenticated, async (req, res) => {
  const { taskId } = req.body;
  if (!req.files || !req.files.file) {
    return res.status(400).send('No file uploaded.');
  }
  const file = req.files.file;
  const uploadPath = path.join(uploadDir, file.name);
  file.mv(uploadPath, async (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to upload file.');
    }
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (task.rows.length === 0) return res.status(404).send('Task not found');
    if (task.rows[0].uploads_count >= 1) {
      return res.status(403).send('You can only reply once to this task');
    }
    await pool.query(
      'UPDATE tasks SET student_upload = $1, uploads_count = uploads_count + 1 WHERE id = $2',
      [file.name, taskId]
    );
    res.send('A fájlt sikeresen feltöltötted');
  });
});

app.get('/student/info', isAuthenticated, (req, res) => {
  if (req.session.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  res.json({ vorname: req.session.user.vorname, surname: req.session.user.surname });
});
app.get('/try', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'try.html'));
});
app.post('/runpython', (req, res) => {
  const { code } = req.body;
  console.log('Received Python code:', code);
  if (!validatePythonCode(code)) {
    return res.status(400).send({ error: 'Invalid or potentially harmful code.' });
  }
  const base64Code = Buffer.from(code).toString('base64');
  exec(`python -c "import base64; exec(base64.b64decode('${base64Code}').decode('utf-8'))"`, { timeout: 5000 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).send({ error: `Error occurred: ${stderr}` });
    }
    res.send({ stdout });
  });
});

function validatePythonCode(code) {
  const forbiddenPatterns = ['import os', 'import sys', 'subprocess', 'open(', 'exec(', 'eval('];
  return !forbiddenPatterns.some(pattern => code.includes(pattern));
}

app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'A fájl nem található.' });
  }
  res.download(filePath);
});
let questions = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'public', 'questions.json'), 'utf8');
  questions = JSON.parse(data);
} catch (err) {
  console.error("Error reading questions:", err);
}

const rooms = {};
let waitingPlayers = [];


function emitCounts() {
  const waitingCount = waitingPlayers.length;
  const activeCount = Object.values(rooms).reduce((sum, room) => sum + room.players.length, 0);
  io.emit('waiting_and_active_counts', { waitingCount, activeCount });
}


io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.emit('waiting_and_active_counts', {
    waitingCount: waitingPlayers.length,
    activeCount: Object.values(rooms).reduce((sum, room) => sum + room.players.length, 0)
  });

  socket.on('get_usernames', () => {
    const activeUsernames = new Set();
    waitingPlayers.forEach(p => activeUsernames.add(p.username));
    Object.values(rooms).forEach(room => {
      room.players.forEach(p => activeUsernames.add(p.username));
    });
  
    socket.emit('usernames_list', Array.from(activeUsernames));
  });

  socket.on('join', ({ username }) => {
    waitingPlayers = waitingPlayers.filter(p => p.username !== username);

    let duplicate = waitingPlayers.some(player => player.username === username);
    for (const roomID in rooms) {
      const room = rooms[roomID];
      if (room.players.some(player => player.username === username)) {
        duplicate = true;
        break;
      }
    }
    if (duplicate) {
      socket.emit('join_error', 'Azonos nevű játékos már csatlakozott! Kérlek, válassz másik nevet vagy próbálkozz később.');
      return;
    }
  
    waitingPlayers.push({ id: socket.id, username });
    console.log(`${username} joined. Waiting players: ${waitingPlayers.map(p => p.username).join(', ')}`);
    socket.emit('waiting_for_other', { message: 'Várj egy kicsit amíg találunk egy ellenfelet...' });
    emitCounts();

    while (waitingPlayers.length >= 2) {
      const roomID = `room${Object.keys(rooms).length + 1}`;
      const player1 = waitingPlayers.shift();
      const player2 = waitingPlayers.shift();
  
      rooms[roomID] = {
        players: [player1, player2],
        answers: {},
        questionActive: false,
        currentQuestionIndex: 0,
        history: []
      };
      console.log(`Room created: ${roomID} with players: ${player1.username}, ${player2.username}`);
  
      [player1, player2].forEach(player => {
        io.to(player.id).emit('joined_room', {
          roomID,
          message: `You have joined ${roomID}. Get ready!`,
          opponent: player.id === player1.id ? player2.username : player1.username,
          totalQuestions: questions.length
        });
        io.sockets.sockets.get(player.id).join(roomID);
      });
      emitCounts();

      startGame(roomID);
    }
  });
  

  socket.on('get_questions', () => {
    socket.emit('questions_data', questions);
  });

  socket.on('answer', ({ roomID, answer }) => {
    const room = rooms[roomID];
    if (!room || !room.questionActive) return;
    console.log(`Answer received in room ${roomID}: ${answer}`);
    room.answers[socket.id] = answer;
    if (Object.keys(room.answers).length === room.players.length) {
      evaluate1v1Answers(roomID); // Itt NE az eredeti evaluateAnswers-t hívd
    }
  });

  function startGame(roomID) {
    const room = rooms[roomID];
    room.questionActive = true;
    io.to(roomID).emit('question', { 
      question: questions[room.currentQuestionIndex].question,
      currentQuestionIndex: room.currentQuestionIndex, 
      totalQuestions: questions.length
    });  }



  function finishGame(roomID) {
    console.log('finishGame called for room:', roomID);
    const room = rooms[roomID];
    io.to(roomID).emit('game_over', {
      message: 'Game over!',
      scores: room.players.map(p => ({ username: p.username, score: p.score })),
      history: room.history
    });
    delete rooms[roomID];
    emitCounts();

  }

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    waitingPlayers = waitingPlayers.filter(player => player.id !== socket.id);
    for (const roomID in rooms) {
        const room = rooms[roomID];
        const playerIndex = room.players.findIndex(player => player.id === socket.id);
        if (playerIndex !== -1) {
            room.players.forEach(player => {
                if (player.id !== socket.id) {
                    io.to(player.id).emit('opponent_left');
                }
            });
            delete rooms[roomID];
            break; // Ha egy socket csak egy szobában lehet, akkor kiléphetünk a ciklusból
            
          }  
    }
    emitCounts();

});

socket.on('teacher_create_room', ({ roomCode }) => {
  if (quizRooms[roomCode]) return; // Ne hozza létre újra
  const room = quizRooms[roomCode] = {
    teacherSocket: socket,
    students: [],
    questions: [],
    scores: {}
  };

  console.log(`👨‍🏫 Tanár létrehozta a szobát: ${roomCode}`);

  socket.on('disconnect', () => {
    console.log(`Tanár kilépett a szobából: ${roomCode}`);
    io.to(roomCode).emit('quiz_aborted');
    delete quizRooms[roomCode];
  });
});


socket.on('upload_quiz_questions', ({ roomCode, questions }) => {
  if (!quizRooms[roomCode]) return;
  quizRooms[roomCode].questions = questions;
  console.log(`📥 Kérdések feltöltve a(z) ${roomCode} szobába. (${questions.length} db)`);
});

socket.on('student_join_quiz', ({ name, roomCode }) => {
  if (!quizRooms[roomCode]) return;

  const room = quizRooms[roomCode];
  const existing = room.students.find(s => s.name === name);

  if (existing) {
    console.log(`${name} újracsatlakozott (${roomCode})`);

    const prevSocketId = existing.socket.id;
    existing.socket = socket;
    const prevScore = room.scores[prevSocketId] || 0;
    room.scores[socket.id] = prevScore;

    delete room.scores[prevSocketId]; // töröljük a régi socket ID-t, ha akarod

  } else {
    console.log(`${name} új diákként csatlakozott (${roomCode})`);
    room.students.push({ name, socket });
    room.scores[socket.id] = 0;
  }
  if (room.teacherSocket) {
    room.teacherSocket.emit('student_joined_room', {
      count: room.students.length
    });
  }
  socket.emit('joined_quiz', { roomCode });
socket.join(roomCode);
  if (room.started && room.currentIndex < room.questions.length) {
    socket.emit('quiz_question', {
      question: room.questions[room.currentIndex].question,
      index: room.currentIndex + 1,
      total: room.questions.length
    });
  }
});




socket.on('start_quiz', ({ roomCode }) => {
  const room = quizRooms[roomCode];
  if (!room || room.questions.length === 0) return;

  console.log(`▶️ Kvíz indítása (${roomCode})`);
  room.currentIndex = 0;
  room.started = true; // ✅ EZ KELL!


  sendNextQuestion(roomCode);
});

function sendNextQuestion(roomCode) {
  const room = quizRooms[roomCode];
  if (!room || room.currentIndex >= room.questions.length) {
    finishQuiz(roomCode);
    return;
  }

  const question = room.questions[room.currentIndex];

  io.to(roomCode).emit('quiz_question', {
    question: question.question,
    index: room.currentIndex + 1,
    total: room.questions.length
  });
  room.teacherSocket.emit('quiz_teacher_question', {
    question: question.question,
    index: room.currentIndex + 1,
    total: room.questions.length
  });

  let remaining = 10;
const countdown = setInterval(() => {
  room.teacherSocket.emit('quiz_timer', { remaining });

  if (remaining <= 0) {
    clearInterval(countdown);
  }

  remaining--;
}, 1000);



  room.answers = {};
  setTimeout(() => evaluateClassroomQuizAnswers(roomCode), 10000);
}


socket.on('submit_answer', ({ roomCode, answer }) => {
  const room = quizRooms[roomCode];
  if (!room || !room.questions[room.currentIndex]) return;

  const student = room.students.find(s => s.socket.id === socket.id);
  if (!student) return;

  room.answers = room.answers || {};
  room.answers[socket.id] = answer;
});

function evaluateClassroomQuizAnswers(roomCode) {
  const room = quizRooms[roomCode];
  if (
    !room ||
    typeof room.currentIndex !== 'number' ||
    room.currentIndex >= room.questions.length
  ) {
    console.warn(`❗️ Érvénytelen kérdés index vagy nem létező szoba: ${roomCode}`);
    return;
  }

  const currentQ = room.questions[room.currentIndex]; // ✅ saját kérdéslista

  room.students.forEach(s => {
    const answer = (room.answers && room.answers[s.socket.id]) || '';
    if (answer.trim().toLowerCase() === currentQ.answer.trim().toLowerCase()) {
      room.scores[s.socket.id] += 1;
    }
  });

  const answerList = room.students.map(s => ({
    name: s.name,
    answer: room.answers[s.socket.id] || '-'
  }));

  room.teacherSocket.emit('quiz_teacher_answers', {
    question: currentQ.question,
    correctAnswer: currentQ.answer,
    answers: answerList
  });

  room.students.forEach(s => {
    s.socket.emit('quiz_score_update', {
      score: room.scores[s.socket.id],
      remaining: room.questions.length - (room.currentIndex + 1)
    });
  });

  room.currentIndex++;
  sendNextQuestion(roomCode); // ✅ most már a jó változót használjuk
}




function evaluate1v1Answers(roomID) {
  const room = rooms[roomID];
  const currentQuestion = questions[room.currentQuestionIndex];

  let roundAnswers = room.players.map(player => ({
    username: player.username,
    answer: room.answers[player.id] || ''
  }));

  room.players.forEach(player => {
    const playerAnswer = room.answers[player.id];
    if (playerAnswer && playerAnswer.toLowerCase() === currentQuestion.answer.toLowerCase()) {
      player.score = (player.score || 0) + 1;
    } else {
      player.score = player.score || 0;
    }
  });

  room.history.push({
    question: currentQuestion.question,
    correctAnswer: currentQuestion.answer,
    answers: roundAnswers
  });

  io.to(roomID).emit('round_results', {
    scores: room.players.map(p => ({ username: p.username, score: p.score }))
  });

  room.currentQuestionIndex++;
  room.questionActive = false;
  room.answers = {};

  if (room.currentQuestionIndex < questions.length) {
    setTimeout(() => startGame(roomID), 1000);
  } else {
    finishGame(roomID);
  }
}



function finishQuiz(roomCode) {
  const room = quizRooms[roomCode];
  if (!room) return;

  const results = room.students.map(s => ({
    name: s.name,
    score: room.scores[s.socket.id] || 0
  })).sort((a, b) => b.score - a.score);

  room.teacherSocket.emit('quiz_results', results);
  room.students.forEach(s => s.socket.emit('quiz_end', results));
  room.teacherSocket.emit('quiz_reset');

  console.log(`🏁 Kvíz lezárva (${roomCode})`);
  delete quizRooms[roomCode];
}


});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
