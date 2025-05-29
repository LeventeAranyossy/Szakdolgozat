
    document.getElementById("year").textContent = new Date().getFullYear();


   function gyakorlasFunction() {
        //alert("Gyakorlás button clicked");
        window.location.href = 'lesson.html?lesson=try2';
    }

    function versusFunction() {
        //alert("Versus button clicked");
        window.location.href = 'game.html';
    }

    function eduFunction() {
       //alert("EDU button clicked");
    window.location.href = '/views/login.html';
    }

    function extraFunction() {
        //alert("Extra button clicked");
        window.location.href = '/views/extra.html';
    }

    fetch('lessons_full.json')
    .then(res => res.json())
    .then(data => {
        const sidebar = document.getElementById('sidebar');

        const homeLink = document.createElement('a');
        homeLink.href = 'try.html';
        homeLink.textContent = '🏠 Főoldal';

        if (window.location.href.includes('try.html')) {
            homeLink.classList.add('active');
        }

        sidebar.appendChild(homeLink);

        data.forEach(lesson => {
            const a = document.createElement('a');
            a.href = `lesson.html?lesson=${lesson.id}`;
            a.textContent = lesson.title;
            sidebar.appendChild(a);
        });

        // 💣💣💣 Itt töröljük az összes inline style-t
        document.querySelectorAll('.sidebar a').forEach(el => {
            el.removeAttribute('style');
        });
    });
   
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
