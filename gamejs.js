document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM teljesen betöltődött ✅");

    const socket = io();
    let username;
    let currentRoomID;
    let totalQuestions = 0;
    let currentQuestionIndex = 0;
    let timerInterval;
    const timerDuration = 25; // Timer duration in seconds
    socket.on('connect', function() {
        socket.emit('get_counts');});
    fetch('/questions.json')
      .then(response => response.json())
      .then(data => {
          totalQuestions = data.length;
          updateQuestionCounter();
      })
      .catch(err => console.error('Hiba a kérdések beolvasásakor:', err));

    function resetGame() {
        document.getElementById('joinGame').classList.remove('hidden');
        document.getElementById('username').value = '';
        document.getElementById('waiting').classList.add('hidden');
        document.getElementById('opponent').classList.add('hidden');
        document.getElementById('gameContent').classList.add('hidden');
        document.getElementById('questionCounter').classList.add('hidden');
        document.getElementById('question').innerText = '';
        document.getElementById('answer').classList.add('hidden');
        document.getElementById('btnAnswer').classList.add('hidden');
        document.getElementById('scores').classList.add('hidden');
        document.getElementById('results').classList.add('hidden');
        document.getElementById('timer').classList.add('hidden');
        document.getElementById('scores').innerHTML = '';
        document.getElementById('results').innerHTML = '';
        document.getElementById('answer').disabled = false; // Enable the input field
        document.getElementById('gameWrapper').classList.add('hidden');

        
        totalQuestions = 0;
        currentQuestionIndex = 0;
        clearInterval(timerInterval);
        document.getElementById('gameDescriptionContainer').classList.remove('hidden');
    }

    document.getElementById('btnJoin').addEventListener('click', function () {
        username = document.getElementById('username').value.trim();
        if (!username) {
            alert('Kérlek, add meg a felhasználóneved!');
            return;
        }
    
        socket.emit('get_usernames');
    
        socket.once('usernames_list', function(usernames) {
            if (usernames.includes(username)) {
                alert('❌ Ez a név már foglalt. Válassz másikat!');
                return;
            }
    
            socket.emit('join', { username });
    
            document.getElementById('waiting').innerText = 'Várakozás az ellenfélre...';
            document.getElementById('waiting').classList.remove('hidden');
            document.getElementById('globalSpinner').style.display = 'block';
            document.getElementById('gameArea').classList.remove('hidden');
            document.getElementById('joinGame').classList.add('hidden');
            document.getElementById('gameDescriptionContainer').classList.add('hidden');
            document.getElementById('gameWrapper').classList.remove('hidden');

        });
    });
    
    
    function hideSpinner() {
        const spinner = document.getElementById('globalSpinner');
        if (!spinner) {
            console.warn('⚠️ Nincs globalSpinner elem a DOM-ban!');
            return;
        }
        spinner.style.display = 'none';
    }
   
    

    socket.on('joined_room', function(data) {
        currentRoomID = data.roomID;
        document.getElementById('joinGame').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');
        document.getElementById('waiting').innerText = data.message || 'Várakozás az ellenfélre...';
        document.getElementById('waiting').classList.remove('hidden');
        document.getElementById('gameDescriptionContainer').classList.add('hidden');
        document.getElementById('opponent').innerText = `Ellenfél: ${data.opponent}`;
        document.getElementById('opponent').classList.remove('hidden');
        document.getElementById('globalSpinner').style.display = 'block';

        hideSpinner();

        updateQuestionCounter();
    });
    
    

    socket.on('question', (data) => {
        const questionEl = document.getElementById('question');
        if (questionEl) {
            questionEl.classList.remove('hidden');          
            questionEl.innerText = data.question;           
        }
        document.getElementById('gameContent').classList.remove('hidden');
        document.getElementById('questionCounter').classList.remove('hidden');
        document.getElementById('waiting').classList.add('hidden');
        document.getElementById('answer').classList.remove('hidden');
        document.getElementById('btnAnswer').classList.remove('hidden');
        document.getElementById('answer').value = ''; // Clear previous answer
        document.getElementById('answer').disabled = false; // Enable the input field
        document.getElementById('timer').classList.remove('hidden');
        document.getElementById('globalSpinner').style.display = 'none';
        hideSpinner();
    
        startTimer();
        currentQuestionIndex = data.currentQuestionIndex + 1;
        totalQuestions = data.totalQuestions;
        updateQuestionCounter();
    });
    

    document.getElementById('btnAnswer').addEventListener('click', function() {
        submitAnswer();
    });

    function submitAnswer() {
        const answer = document.getElementById('answer').value || 'nothing';
        socket.emit('answer', { roomID: currentRoomID, answer, username });
        document.getElementById('waiting').innerText = 'Várakozás a másik játékos válaszára...';
        document.getElementById('waiting').classList.remove('hidden');
        document.getElementById('answer').classList.add('hidden');
        document.getElementById('btnAnswer').classList.add('hidden');
        document.getElementById('answer').disabled = true; // Disable the input field
        document.getElementById('globalSpinner').style.display = 'none';
        hideSpinner();
        clearInterval(timerInterval);

    }

    function startTimer() {
        document.getElementById('globalSpinner').style.display = 'none';

        let timeLeft = timerDuration;
        document.getElementById('timer').innerText = `Idő: ${timeLeft} másodperc`;
        timerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('timer').innerText = `Idő: ${timeLeft} másodperc`;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                submitAnswer();
            }
        }, 1000);
    }

    socket.on('waiting_and_active_counts', function(data) {
        document.getElementById('waitingCount').innerText = data.waitingCount;
        document.getElementById('activeCount').innerText = data.activeCount;

    });
    
    socket.on('waiting_for_other', function(data) {
        const waitingText = document.getElementById('waitingText');
        const globalSpinner = document.getElementById('globalSpinner');
    
        if (waitingText) {
          waitingText.innerText = data.message;
        }
    
        if (globalSpinner && data.message) {
          globalSpinner.style.display = 'block';
        }
    });
    
    
    

    socket.on('round_results', function(data) {
        let scoresHTML = 'Pontszámok:<br>';
        data.scores.forEach(score => {
            scoresHTML += `${score.username}: ${score.score} pont<br>`;
        });
        document.getElementById('scores').innerHTML = scoresHTML;
        document.getElementById('scores').classList.remove('hidden');
        document.getElementById('waiting').classList.add('hidden');
        document.getElementById('globalSpinner').style.display = 'none';
        hideSpinner();

    });

    socket.on('game_over', (data) => {
        document.getElementById('timer').classList.add('hidden');
        document.getElementById('questionCounter').classList.add('hidden');
        document.getElementById('gameContent').classList.add('hidden');
        document.getElementById('scores').classList.add('hidden');
        document.getElementById('waiting').classList.add('hidden');
        document.getElementById('answer').classList.add('hidden');
        document.getElementById('btnAnswer').classList.add('hidden');
        document.getElementById('globalSpinner').style.display = 'none';
        const questionEl = document.getElementById('question');
            if (questionEl) {
                questionEl.innerText = '';
                questionEl.classList.add('hidden');
            }
        
        hideSpinner();
        document.getElementById('question').innerText = '';
        
        let content = `<h2>Játék vége!</h2>`;
        content += `<h3>Pontszámok:</h3><ul>`;
        data.scores.forEach(score => {
           content += `<li>${score.username}: ${score.score} pont</li>`;
        });
        content += `</ul>`;
        let myScore = 0;
        let opponentScore = 0;
        data.scores.forEach(score => {
          if (score.username === username) {
             myScore = score.score;
          } else {
             opponentScore = score.score;
          }
        });
        
        let resultMessage = "";
        if (myScore > opponentScore) {
          resultMessage = "Gratulálunk, nyertél!";
        } else if (myScore < opponentScore) {
          resultMessage = "Sajnos nem nyertél.";
        } else {
          resultMessage = "Döntetlen!";
        }
        content += `<h3>${resultMessage}</h3>`;
        content += `<h3>Kérdések és válaszok:</h3>`;
        data.history.forEach((item, index) => {
          let myAnswerObj = item.answers.find(ans => ans.username === username);
          let myAnswer = myAnswerObj ? myAnswerObj.answer : "Nincs válasz";
          let point = (myAnswer.toLowerCase() === item.correctAnswer.toLowerCase()) ? 1 : 0;
          
          content += `<div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
                        <strong>${index+1}. Kérdés:</strong> ${item.question}<br>
                        <strong>Te válaszoltál:</strong> ${myAnswer} (${point} pont)<br>
                        <strong>Helyes válasz:</strong> ${item.correctAnswer}<br>
                      </div>`;
        });
        
        document.getElementById("results").innerHTML = content;
        document.getElementById("results").classList.remove("hidden");
    });
    

    socket.on('opponent_left', function() {
        alert('Az ellenfél kilépett a játékból.');
        resetGame(); // Reset the game state and show the join game screen
    });

    socket.on('error', function(err) {
        console.error('Hiba történt:', err);
    });

    socket.on('join_error', function(err) {
        alert(err);
        document.getElementById('joinGame').classList.remove('hidden');
        document.getElementById('waiting').classList.add('hidden');
        document.getElementById('globalSpinner').style.display = 'none';
        document.getElementById('gameArea').classList.add('hidden');
    });

    function updateQuestionCounter() {
        const remainingQuestions = totalQuestions - currentQuestionIndex;
        document.getElementById('questionCounter').innerText = `Hátralévő kérdések: ${remainingQuestions}`;
    }
});
