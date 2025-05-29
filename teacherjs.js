console.log("✅ JS betöltve");

 let students = [],
        tasks = [],
        taskSelectedStudents = [];
      let quizRoomCode = null;
      let socket = null;
      let joinedStudentCount = 0;
      async function loadStudents() {
        const res = await fetch('/teacher/students');
        students = await res.json();
        renderStudents();
      }

      function filterStudents() {
        renderStudents();
      }

      function renderStudents() {
        const list = document.getElementById('studentList');
        list.innerHTML = '';
        const query = document.getElementById('studentSearch').value.toLowerCase();
        const matched = students.filter(s => `${s.vorname} ${s.surname}`.toLowerCase().includes(query));
        if (query.length > 0) {
          matched.forEach(s => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = `${s.vorname} ${s.surname}`;
            div.onclick = () => loadStudentTasks(s.id);
            list.appendChild(div);
          });
        }
      }
      async function loadStudentTasks(studentId) {
        const res = await fetch(`/teacher/student-tasks/${studentId}`);
        const tasks = await res.json();
        const display = document.getElementById('studentTaskDisplay');
        display.innerHTML = ''; // előző tartalom törlése
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✖ Bezárás';
        closeBtn.className = 'close-btn';
        closeBtn.onclick = () => display.innerHTML = '';
        display.appendChild(closeBtn);
      
        if (tasks.length === 0) {
          display.innerHTML += '<p>Nincs feladat ehhez a diákhoz.</p>';
        } else {
          tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = 'task-card';
      
            const status = task.student_upload ? '✅ válaszolt' : '❌ nem válaszolt';
            const grade = task.grade !== null ? `<strong>Pontszám:</strong> ${task.grade}<br>` : '';
            const feedback = task.feedback ? `<strong>Értékelés:</strong> ${task.feedback}<br>` : '';
            const download = task.student_upload
              ? `<a href="#" onclick="downloadFile('${task.student_upload}'); return false;">📎 Letöltés</a><br>`
              : '';
      
            card.innerHTML = `
              <h3>${task.name}</h3>
              <div class="status">${status}</div>
              ${grade}${feedback}${download}
            `;
      
            display.appendChild(card);
          });
        }
      }
      
      function filterStudentsForTask() {
        const list = document.getElementById('taskStudentList');
        const selectedBox = document.getElementById('selectedStudentList');
        const query = document.getElementById('taskStudentSearch').value.toLowerCase().trim();
      
        list.innerHTML = '';
        selectedBox.innerHTML = '';
      
        if (query.length > 0) {
          const matched = students.filter(s => `${s.vorname} ${s.surname}`.toLowerCase().includes(query));
          matched.forEach(s => {
            if (!taskSelectedStudents.includes(s.id)) {
              const div = document.createElement('div');
              div.className = 'dropdown-item';
              div.textContent = `${s.vorname} ${s.surname}`;
              div.onclick = () => toggleTaskStudent(s.id);
              list.appendChild(div);
            }
          });
        }
        taskSelectedStudents.forEach(id => {
          const student = students.find(s => s.id === id);
          if (student) {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = `✔ ${student.vorname} ${student.surname}`;
            div.onclick = () => toggleTaskStudent(id);
            div.style.fontWeight = 'bold';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #555';
            selectedBox.appendChild(div);
          }
        });
      }
      
      
      
      

      function toggleTaskStudent(id) {
        if (taskSelectedStudents.includes(id)) {
          taskSelectedStudents = taskSelectedStudents.filter(sid => sid !== id);
        } else {
          taskSelectedStudents.push(id);
        }
        filterStudentsForTask();
      }
      async function assignTask(event) {
        event.preventDefault();
        const name = document.getElementById('taskName').value.trim();
        const desc = document.getElementById('taskDesc').value.trim();
        if (!name || !desc || taskSelectedStudents.length === 0) {
          return alert('Minden mező kötelező.');
        }
        const res = await fetch('/teacher/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            taskName: name,
            description: desc,
            studentIds: taskSelectedStudents
          })
        });
        const r = await res.json();
        alert(r.message || 'Sikeres küldés');
        taskSelectedStudents = [];
        filterStudentsForTask();
        loadTasks();
      }
      async function loadTasks() {
        const res = await fetch('/teacher/tasks/list');
        tasks = await res.json();
        renderTasks();
      }

      function renderTasks(showAll = true) {
        const list = document.getElementById('taskList');
        list.innerHTML = '';
        const query = document.getElementById('taskSearch').value.toLowerCase();
        const filtered = showAll ? tasks : tasks.filter(t => t.name.toLowerCase().includes(query));
        if (query.trim().length === 0) return;
        filtered.forEach(t => {
          const div = document.createElement('div');
          div.className = 'dropdown-item';
          div.textContent = t.name;
          div.onclick = () => reviewTask(t.id, t.name);
          list.appendChild(div);
        });
      }
      function filterTasks() {
        renderTasks(false);
      }
      async function reviewTask(taskId, taskName) {
        const res = await fetch(`/teacher/submissions/${taskId}`);
        const submissions = await res.json();
        const container = document.getElementById('taskReviewDisplay');
        container.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✖ Bezárás';
        closeBtn.className = 'close-btn';
        closeBtn.onclick = () => container.innerHTML = '';
        container.appendChild(closeBtn);
        const title = document.createElement('h3');
        title.textContent = `Feladat: ${taskName}`;
        container.appendChild(title);
        if (!submissions.length) {
          const none = document.createElement('p');
          none.textContent = 'Nincs beadás ehhez a feladathoz.';
          container.appendChild(none);
          return;
        }
        submissions.forEach(sub => {
          const item = document.createElement('div');
          item.className = 'submission-item';
          item.dataset.studentId = sub.student_id;
          item.dataset.taskId = sub.task_id;
          const uploadPart = sub.student_upload
  ? `<a href="#" onclick="downloadFile('${sub.student_upload}'); return false;">📎 Letöltés</a><br>`
  : `<span style="color: crimson; font-weight: bold;">❌ Nem érkezett válasz</span><br>`;

item.innerHTML = `
  <p>${sub.student_name}</p>
  ${uploadPart}
  <input id="grade-${sub.student_id}" type="number" placeholder="Értékelés" required>
  <br>
  <textarea id="feedback-${sub.student_id}" placeholder="Visszajelzés" required></textarea>
  <br>
`;

          container.appendChild(item);
        });


        const buttonWrapper = document.createElement('div');
        buttonWrapper.style.display = 'flex';
        buttonWrapper.style.gap = '10px';
        buttonWrapper.style.marginBottom = '20px';

        const closeReviewBtn = document.createElement('button'); // másik helyen, más néven
        closeBtn.textContent = '✖ Bezárás';
        closeBtn.className = 'close-btn';
        closeBtn.onclick = () => container.innerHTML = '';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '✔ Mentés';
        saveBtn.className = 'save-btn';
        saveBtn.onclick = submitAllReviews;

        buttonWrapper.appendChild(closeBtn);
        buttonWrapper.appendChild(saveBtn);
        container.appendChild(buttonWrapper);




      }
      window.onload = () => {
        window.quizQuestionsUploaded = false; // ← ide kerüljön!
        fetch('/teacher/info').then(res => res.json()).then(data => {
          if (data && data.vorname) {
            document.getElementById('welcomeMessage').textContent = `Üdvözöljük, ${data.vorname}!`;
          }
        });
        loadStudents();
        loadTasks(); // Ne változtasd meg itt, csak ne rendereljen még
        window.closeResultsModal = function () {
          document.getElementById('resultsModal').style.display = 'none';
        };
      };

      function submitAllReviews() {
        const submissions = document.querySelectorAll('#taskReviewDisplay .submission-item');
        const feedbacks = [];
        submissions.forEach(item => {
          const studentId = item.dataset.studentId;
          const taskId = item.dataset.taskId;
          const grade = document.getElementById(`grade-${studentId}`).value;
          const feedback = document.getElementById(`feedback-${studentId}`).value;
          if (grade && feedback) {
            feedbacks.push({
              studentId,
              taskId,
              grade,
              feedback
            });
          }
        });
        if (feedbacks.length === 0) {
          alert("Nincs kitöltött értékelés.");
          return;
        }
        fetch('/teacher/feedback/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            feedbacks
          })
        }).then(res => res.json()).then(data => {
          alert(data.message || "Értékelések mentve.");
        }).catch(err => {
          console.error('Mentési hiba:', err);
          alert("Hiba történt mentés közben.");
        });
      }

      function downloadFile(filename) {
        fetch(`/uploads/${filename}`).then(res => {
          if (res.status === 404) {
            alert("⚠ A fájl nem található.");
          } else {
            const a = document.createElement('a');
            a.href = `/uploads/${filename}`;
            a.download = filename;
            a.click();
          }
        }).catch(err => {
          console.error('Letöltési hiba:', err);
          alert("⚠ Hiba történt a letöltés során.");
        });
      }

      function generateRoomCode() {
        quizRoomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        document.getElementById('roomCodeDisplay').textContent = `Szobakód: ${quizRoomCode}`;
        socket = io();
        setupQuizListeners();
        socket.emit('teacher_create_room', {
          roomCode: quizRoomCode
        });
        socket.on('student_joined_room', data => {
          joinedStudentCount = data.count;
          document.getElementById('joinedCount').textContent = `Csatlakozott diákok száma: ${data.count}`;
        
          const startBtn = document.getElementById('startNewQuizBtn');
          startBtn.disabled = data.count === 0;
          startBtn.style.display = data.count === 0 ? 'none' : 'inline-block';

        });
        
        
      }

      function uploadQuizQuestions() {
        if (!quizRoomCode || !socket) {
          return alert("Előbb generálj szobakódot!");
        }
      
        const fileInput = document.getElementById('quizFile');
        if (!fileInput.files[0]) return alert("Válassz ki egy JSON fájlt!");
      
        const reader = new FileReader();
        reader.onload = function(event) {
          try {
            const json = JSON.parse(event.target.result);
            if (!Array.isArray(json)) throw "Nem tömb";
      
            socket.emit('upload_quiz_questions', {
              questions: json,
              roomCode: quizRoomCode
            });
            window.quizQuestionsUploaded = true;

            document.getElementById('quizQuestionText').textContent = "✅ Kérdések sikeresen feltöltve!";
            document.getElementById('quizCountdownText').textContent = "";
      
          } catch (err) {
            alert("Hibás JSON formátum!");
          }
        };
      
        reader.readAsText(fileInput.files[0]);
      }
      

      function startQuiz() {
        console.log("▶️ startQuiz meghívva");
        window.quizActive = true;


        if (!joinedStudentCount || parseInt(joinedStudentCount) === 0) {
          const errorEl = document.getElementById('quizWarning'); // ✅ Ez a helyes
          errorEl.textContent = "⚠️ Nincs csatlakozott diák – nem lehet elindítani a kvízt.";
          errorEl.style.display = 'block';
          return;
        }
        if (typeof window.quizQuestionsUploaded === 'undefined' || !window.quizQuestionsUploaded) {
          alert("⚠️ Előbb tölts fel egy kérdésfájlt!");
          return;
        }
        socket.emit('start_quiz', { roomCode: quizRoomCode });
        document.getElementById('roomCodeDisplay').style.display = 'none';
        document.getElementById('quizFile').style.display = 'none';
        document.querySelector('label[for="quizFile"]').style.display = 'none';
        document.getElementById('startNewQuizBtn').style.display = 'none';
        document.getElementById('uploadQuizBtn').style.display = 'none';


        const genBtn = document.querySelector('button[onclick="generateRoomCode()"]');
        if (genBtn) genBtn.style.display = 'none';


      }
      
      
      

      function setupQuizListeners() {
        socket.on('quiz_reset', () => {
          document.getElementById('roomCodeDisplay').textContent = '';
          document.getElementById('quizQuestionText').textContent = '';
          const countdown = document.getElementById('quizCountdownText');
if (countdown) {
  countdown.textContent = '';
  countdown.style.display = 'none'; // 👈 ez önmagában elég
  countdown.classList.remove('hidden'); // ⛔ ne adj hozzá, ha nem használod
}

          document.getElementById('joinedCount').textContent = 'Csatlakozott diákok száma: 0';
          document.getElementById('roomCodeDisplay').style.display = 'block';
          document.getElementById('quizFile').style.display = 'block';
          document.getElementById('quizFile').value = ''; // 👈 reseteli a fájlt
          document.getElementById('uploadQuizBtn').style.display = 'block';
          document.querySelector('label[for="quizFile"]').style.display = 'block';
          document.getElementById('startNewQuizBtn').style.display = 'none';
        
          const genBtn = document.querySelector('button[onclick="generateRoomCode()"]');
          if (genBtn) genBtn.style.display = 'inline-block';
          window.quizQuestionsUploaded = false;
          window.quizActive = false;

        });
        
        
        socket.on('quiz_teacher_question', data => {
          if (!window.quizActive) return; // ⛔ NE CSINÁLJON SEMMIT, ha már vége
        
          const qEl = document.getElementById('quizQuestionText');
          const cEl = document.getElementById('quizCountdownText');
          if (qEl) {
            qEl.textContent = `❓ ${data.index}/${data.total}: ${data.question}`;
            qEl.style.display = "block";
          }
          if (cEl && data.remaining > 0) {
            cEl.textContent = '';
            cEl.style.display = "block";
          }
        });
        
        socket.on('quiz_timer', data => {
          if (!window.quizActive) return; // ⛔ ne frissítse, ha nincs aktív kvíz
        
          const cEl = document.getElementById('quizCountdownText');
          if (cEl) {
            cEl.textContent = `⏱ Visszaszámláló: ${data.remaining} mp`;
            cEl.style.display = "block";
          }
        });
        
        socket.on('quiz_results', results => {
          const container = document.getElementById('resultsContent');
          container.innerHTML = '';
        
          results.forEach(r => {
            const p = document.createElement('p');
            p.textContent = `${r.name}: ${r.score} pont`;
            container.appendChild(p);
          });
        
          document.getElementById('resultsModal').style.display = 'flex';
        });
        
        function closeResultsModal() {
          document.getElementById('resultsModal').style.display = 'none';
        }
        
      }
      function showSection(id) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
      
        document.querySelector(`.tab[onclick*="${id}"]`).classList.add('active');
        const section = document.getElementById(id);
        if (section) section.style.display = 'block';
        document.getElementById('studentSidePanel').style.display = id === 'students' ? 'block' : 'none';
        document.getElementById('taskSidePanel').style.display = id === 'tasks' ? 'block' : 'none';
      }
      
   
      
      
      document.addEventListener('DOMContentLoaded', () => {
        const startNewBtn = document.getElementById('startNewQuizBtn');
        if (startNewBtn) {
          startNewBtn.addEventListener('click', () => {
            console.log("▶️ Új kvíz indítása gombra kattintottak");
            startQuiz(); // meglévő függvényed
          });
        }
      });
      