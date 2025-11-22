document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            window.location.href = 'admin.html';
        } else {
            errorMessage.textContent = data.message || 'Invalid credentials';
            errorMessage.classList.add('show');
        }
    } catch (error) {
        errorMessage.textContent = 'Connection error. Please make sure the server is running.';
        errorMessage.classList.add('show');
    }
});