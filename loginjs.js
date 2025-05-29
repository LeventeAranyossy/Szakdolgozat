 const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('success')) {
            alert('✅ Sikeres regisztráció! Most már bejelentkezhetsz.');
        }

        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = loginForm.email.value;
            const password = loginForm.password.value;

            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (result.success) {
                window.location.href = result.redirect || '/';
            } else {
                alert(result.message || 'Hiba történt a bejelentkezés során.');
            }
        });