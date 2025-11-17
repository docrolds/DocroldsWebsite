import { useState, useEffect } from 'react';

function Navigation() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
  }, []);

  return (
    <nav>
      <ul>
        <li><a href="index.html" className="active">Home</a></li>
        <li><a href="beats.html">Beats</a></li>
        {isAdmin ? (
          <li><a href="admin.html">Admin</a></li>
        ) : (
          <li><a href="login.html">Login</a></li>
        )}
      </ul>
    </nav>
  );
}

export default Navigation;
