import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminLoginPage from '../src/pages/AdminLoginPage';
import { AdminAuthProvider } from '../src/context/AdminAuthContext';

function renderPage(): void {
  render(
    <MemoryRouter>
      <AdminAuthProvider>
        <AdminLoginPage />
      </AdminAuthProvider>
    </MemoryRouter>
  );
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('logs in and stores the admin token on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'admin-token',
        user: { id: 'u1', username: 'admin', role: 'admin' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await userEvent.type(screen.getByLabelText(/username/i), 'admin');
    await userEvent.type(screen.getByLabelText(/password/i), 'correct-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(localStorage.getItem('adminToken')).toBe('admin-token'));

    const [url, options] = fetchMock.mock.calls.find(
      ([callUrl]: [string]) => callUrl.endsWith('/auth/login')
    )!;
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(options.body)).toEqual({
      username: 'admin',
      password: 'correct-password',
    });
  });

  it('shows an error and does not store a token on invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      })
    );

    renderPage();

    await userEvent.type(screen.getByLabelText(/username/i), 'admin');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    expect(localStorage.getItem('adminToken')).toBeNull();
  });
});
