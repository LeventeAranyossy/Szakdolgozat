const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lesson');

    fetch('lessons_full.json')
        .then(res => res.json())
        .then(data => {
            const sidebar = document.getElementById('sidebar');
            
            const homeLink = document.createElement('a');
            homeLink.href = 'try.html';
            homeLink.textContent = '🏠 Főoldal';
            sidebar.appendChild(homeLink);
            
            data.forEach(lesson => {
                const a = document.createElement('a');
                a.href = `lesson.html?lesson=${lesson.id}`;
                a.textContent = lesson.title;
                if (lesson.id === lessonId) a.classList.add('active');
                sidebar.appendChild(a);
            });

            const lesson = data.find(l => l.id === lessonId);
            if (!lesson) return;

            document.getElementById('lessonTitle').textContent = lesson.title;
            const container = document.getElementById('taskContainer');

            lesson.tasks.forEach((task, index) => {
                const div = document.createElement('div');
                div.className = 'task-block';
                div.innerHTML = `
                    <h4>${task.description}</h4>
                    ${task.tutorial ? `<p class="tutorial-text">💡 ${task.tutorial}</p>` : ''}
                    ${task.hint ? `<p class="hint-text">🛠️ Tipp: ${task.hint}</p>` : ''}
                    <textarea id="code${index}" rows="5" placeholder="# Írd ide a Python kódot"></textarea>
                    <pre id="result${index}">Eredmények ide jelennek meg...</pre>
                    <button onclick="runPythonCode('code${index}', 'result${index}')">Futtatás</button>
                `;
                container.appendChild(div);
            });
        document.querySelectorAll('.sidebar a').forEach(el => {
            el.removeAttribute('style');
        });
        });

    function runPythonCode(textAreaId, resultId) {
        const code = document.getElementById(textAreaId).value;
        fetch('/runpython', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({ code })
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById(resultId).textContent = data.stdout || data.error;
        })
        .catch(() => {
            document.getElementById(resultId).textContent = 'Hiba történt a kód futtatása során.';
        });
    }

    
        
  
   
    const observer = new MutationObserver(() => {
        document.querySelectorAll('.sidebar a').forEach(el => {
            if (el.style.border && el.style.border.includes('red')) {
                el.style.border = 'none';
                el.removeAttribute('style');
            }
        });
    });
    observer.observe(document.getElementById('sidebar'), {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['style']
    });
