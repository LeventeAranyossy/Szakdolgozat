document.querySelector("form").addEventListener("submit", async function(event) {
      event.preventDefault();
      const formData = new FormData(this);
      const response = await fetch("/register", {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        alert(result.message);
        window.location.href = "/views/login.html";
      } else {
        alert(result.message);
      }
    });