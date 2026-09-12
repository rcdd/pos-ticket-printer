import {useState} from 'preact/hooks';
import {api, setToken} from '../api.js';

export function Login({onLogin}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const data = await api('/user/login', {method: 'POST', body: {username, password}});
            setToken(data.token);
            onLogin(data.user);
        } catch (err) {
            setError(err.status === 401 || err.status === 404
                ? 'Utilizador ou palavra-passe errados.'
                : err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div class="screen">
            <form class="center card" onSubmit={submit}>
                <h2>Iniciar sessão</h2>
                <input
                    placeholder="Utilizador"
                    value={username}
                    autocapitalize="none"
                    autocomplete="username"
                    onInput={(e) => setUsername(e.currentTarget.value)}
                />
                <input
                    placeholder="Palavra-passe"
                    type="password"
                    value={password}
                    autocomplete="current-password"
                    onInput={(e) => setPassword(e.currentTarget.value)}
                />
                {error && <p class="error-text">{error}</p>}
                <button class="btn" type="submit" disabled={busy || !username || !password}>
                    {busy ? 'A entrar…' : 'Entrar'}
                </button>
            </form>
        </div>
    );
}
