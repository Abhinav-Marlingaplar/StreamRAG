import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, setAuthToken } from "../lib/api";

export default function Login() {
	const navigate = useNavigate();
	const [form, setForm] = useState({ email: "", password: "" });
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const onSubmit = async (event) => {
		event.preventDefault();
		setError("");
		setLoading(true);
		try {
			const data = await loginUser(form);
			setAuthToken(data.access_token);
			navigate("/app/overview");
		} catch (err) {
			setError(err.response?.data?.detail || "Login failed. Check backend connectivity.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auth-wrap">
			<form
				className="auth-card glass-panel"
				onSubmit={onSubmit}
			>
				<h1>Welcome back</h1>
				<p className="muted">Sign in to access StreamRAG control surfaces.</p>
				<input
					className="input"
					onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
					placeholder="Email"
					required
					type="email"
					value={form.email}
				/>
				<input
					className="input"
					onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
					placeholder="Password"
					required
					type="password"
					value={form.password}
				/>
				{error && <p className="error-text">{error}</p>}
				<button
					className="btn btn-primary"
					disabled={loading}
					type="submit"
				>
					{loading ? "Signing in..." : "Sign In"}
				</button>
				<p className="muted">
					New here?{" "}
					<Link to="/register">
						Create account
					</Link>
				</p>
			</form>
		</div>
	);
}