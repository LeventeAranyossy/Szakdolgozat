
    async function fetchStudentInfo() {
      const res = await fetch('/student/info');
      const data = await res.json();
      const name = `${data.vorname} ${data.surname}`;
      document.getElementById('welcomeMsg').textContent = `Üdvözöljük, ${name}!`;
    }

    async function fetchTasks() {
      const res = await fetch('/student/tasks', { method: 'POST' });
    
      if (!res.headers.get('content-type')?.includes('application/json')) {
        const text = await res.text();
        console.error("Nem JSON válasz:", text);
        alert("⚠ A munkamenet lejárt vagy hiba történt. Jelentkezz be újra.");
        window.location.href = "/login";
        return;
      }
    
      const tasks = await res.json();
      const container = document.getElementById('taskList');
      container.innerHTML = '';

    
      let missingCount = 0;
    
      const listContainer = document.createElement('div');
      listContainer.className = 'task-list';
    
      tasks.forEach(task => {
        const row = document.createElement('div');
        row.className = 'task-row';
    
        const header = document.createElement('div');
        header.className = 'task-header';
    
        const titleWrapper = document.createElement('span');
          titleWrapper.style.display = 'flex';
          titleWrapper.style.alignItems = 'center';
          titleWrapper.style.gap = '8px';

          const taskIcon = document.createElement('img');
          taskIcon.src = '/task.png';
          taskIcon.alt = 'Feladat ikon';
          taskIcon.style.width = '20px';
          taskIcon.style.height = '20px';

const taskName = document.createElement('span');
taskName.textContent = task.name;

titleWrapper.append(taskIcon, taskName);

    
        const teacher = document.createElement('span');
        teacher.textContent = `👨‍🏫 ${task.teacher_name || 'Ismeretlen'}`;
    
        const grade = document.createElement('span');
        grade.textContent = `📊 Értékelés: ${task.grade || '-'}`;
    
        const icon = document.createElement('img');
        icon.style.width = '24px';
        icon.style.height = '24px';
        icon.style.marginLeft = '10px';
        icon.alt = 'állapot ikon';
        icon.src = task.student_upload ? '/check.png' : '/x.png';

    
        header.append(titleWrapper, teacher, grade, icon);

        const details = document.createElement('div');
        details.className = 'task-details';
        details.innerHTML = `
          <p><strong>Leírás:</strong> ${task.description}</p>
          <p><strong>Visszajelzés:</strong> ${task.feedback || '—'}</p>
        `;
    
        row.onclick = e => {
          if (e.target.tagName.toLowerCase() === 'button' || e.target.tagName.toLowerCase() === 'input') return;
          details.style.display = (details.style.display === 'none' || !details.style.display) ? 'block' : 'none';
        };
        if (!task.student_upload) {
          missingCount++;
    
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = ".txt";
    
          const uploadBtn = document.createElement('button');
          uploadBtn.textContent = 'Feltöltés';
          uploadBtn.onclick = e => uploadTask(e, task.id, fileInput);
    
          details.appendChild(fileInput);
          details.appendChild(uploadBtn);
        }
    
        row.append(header, details);
        listContainer.appendChild(row);
      });
    
      container.appendChild(listContainer);
      updateNotification(missingCount);
    }
    function updateNotification(count) {
      const note = document.getElementById('notification');
      if (count > 0) {
        note.textContent = `❗️ ${count} feladat még nincs megoldva.`;
      } else {
        note.textContent = `✅ Nincs új feladatod.`;
      }
    }

    function logout() {
      window.location.href = '/logout';
    }

    window.onload = async () => {
      await fetchStudentInfo();
      await fetchTasks();
    }
    let quizSocket = null;
    let currentQuizRoom = null;
    
    async function joinQuiz() {
      const code = document.getElementById('quizCodeInput').value.trim().toUpperCase();
      if (!code) return alert("Add meg a szobakódot!");
    
      const res = await fetch('/student/info');
      const data = await res.json();
      const name = `${data.vorname} ${data.surname}`;
    
      quizSocket = io();
    
      quizSocket.emit('student_join_quiz', { roomCode: code, name });
    
      quizSocket.on('join_error', msg => alert(msg));
    
      quizSocket.on('joined_quiz', data => {
        currentQuizRoom = data.roomCode;
        document.getElementById('quizGameArea').style.display = 'block';
        document.getElementById('quizJoinCard').scrollIntoView({ behavior: 'smooth' });
        document.getElementById('quizQuestionText').textContent =
        '⏳ Várakozás a tanárra, amíg elindítja a kvízt...';
          document.getElementById('quizCodeInput').style.display = 'none';
  document.querySelector('#quizJoinCard button').style.display = 'none'

        document.getElementById('quizAnswerInput').style.display = 'none';
        document.getElementById('quizAnswerInput').disabled = true;
        document.querySelector('#quizGameArea button').style.display = 'none';
        let countdownInterval;

        quizSocket.on('quiz_question', data => {
          const questionText = document.getElementById('quizQuestionText');
          const answerInput = document.getElementById('quizAnswerInput');
          const answerButton = document.querySelector('#quizGameArea button');
          questionText.textContent = `❓ ${data.index}/${data.total}: ${data.question}`;
          answerInput.style.display = 'inline-block';
          answerInput.disabled = false;
          answerInput.value = '';
          answerInput.placeholder = "Válasz írása...";
          answerButton.style.display = 'inline-block';
          answerButton.disabled = false;
          let timeLeft = 10;
          const scoreInfo = document.getElementById('quizScoreInfo');
          scoreInfo.textContent = `⏱ Hátralévő idő: ${timeLeft} mp`;
        
          clearInterval(countdownInterval);
          countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
              clearInterval(countdownInterval);
              scoreInfo.textContent = '⏱ Idő lejárt!';
              answerInput.disabled = true;
              answerButton.disabled = true;
            } else {
              scoreInfo.textContent = `⏱ Hátralévő idő: ${timeLeft} mp`;
            }
          }, 1000);
        });
        

        quizSocket.on('quiz_score_update', data => {
          document.getElementById('quizScoreInfo').textContent =
            `🏅 Pontszám: ${data.score} | 📉 Hátralévő kérdések: ${data.remaining}`;
        });
    
        quizSocket.on('quiz_end', results => {
          showResultsModal(results); // modalba rakjuk az eredményeket
          document.getElementById('quizGameArea').style.display = 'none';
          document.getElementById('quizCodeInput').style.display = 'inline-block';
          document.querySelector('#quizJoinCard button').style.display = 'inline-block';
          document.getElementById('quizQuestionText').textContent = '';
          document.getElementById('quizScoreInfo').textContent = '';
        
          quizSocket.disconnect();
        });
        

        quizSocket.on('quiz_aborted', () => {
          alert("⚠️ A tanár kilépett, a kvíz megszakadt.");
          document.getElementById('quizGameArea').style.display = 'none';
          document.getElementById('quizCodeInput').style.display = 'inline-block';
          document.querySelector('#quizJoinCard button').style.display = 'inline-block';
          document.getElementById('quizQuestionText').textContent = '';
          document.getElementById('quizScoreInfo').textContent = '';
        });
        
      });
    }
    
    
    function submitQuizAnswer() {
      const answerInput = document.getElementById('quizAnswerInput');
      const answerButton = document.querySelector('#quizGameArea button');
    
      const answer = answerInput.value.trim();
      if (!answer || !quizSocket || !currentQuizRoom) return;
    
      quizSocket.emit('submit_answer', { roomCode: currentQuizRoom, answer });
      answerInput.style.display = 'none';
      answerInput.disabled = true;
      answerButton.style.display = 'none';
      answerButton.disabled = true;
    }
    async function uploadTask(event, taskId, fileInput) {
      event.preventDefault();
      const file = fileInput.files[0];
      if (!file) {
        alert('📎 Válassz ki egy fájlt a feltöltéshez!');
        return;
      }
    
      const formData = new FormData();
      formData.append('taskId', taskId);
      formData.append('file', file);
    
      try {
        const res = await fetch('/student/upload', {
          method: 'POST',
          body: formData
        });
    
        const result = await res.text();
        alert(result);
        fetchTasks(); // frissíti a listát a feltöltés után
      } catch (err) {
        console.error("Hiba a feltöltés során:", err);
        alert("⚠ Hiba történt a feltöltés közben.");
      }
    }
    
    function showResultsModal(results) {
      const container = document.getElementById('resultsContent');
      container.innerHTML = '';
      results.forEach(r => {
        const p = document.createElement('p');
        p.textContent = `${r.name}: ${r.score} pont`;
        container.appendChild(p);
      });
      document.getElementById('resultsModal').style.display = 'flex';
    }
    
