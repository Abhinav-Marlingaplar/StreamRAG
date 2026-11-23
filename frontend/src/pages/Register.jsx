import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../lib/api";

export default function Register() {
	const navigate = useNavigate();
	const [form, setForm] = useState({ email: "", password: "" });
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const onSubmit = async (event) => {
		event.preventDefault();
		setError("");
		setSuccess("");
		setLoading(true);
		try {
			await registerUser(form);
			setSuccess("Account created. Redirecting to sign in...");
			setTimeout(() => navigate("/login"), 900);
		} catch (err) {
			setError(err.response?.data?.detail || "Registration failed. Try a different email.");
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
				<h1>Create account</h1>
				<p className="muted">Launch your local StreamRAG workspace.</p>
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
				{success && <p className="success-text">{success}</p>}
				<button
					className="btn btn-primary"
					disabled={loading}
					type="submit"
				>
					{loading ? "Creating..." : "Create Account"}
				</button>
				<p className="muted">
					Already have an account?{" "}
					<Link to="/login">
						Sign in
					</Link>
				</p>
			</form>
		</div>
	);
}