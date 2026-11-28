import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../app/AuthLayout";
import { Button, ErrorBanner, Notice } from "../app/ui";
import { registerUser } from "../lib/api";
import { errorMessage } from "../lib/format";

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
			setSuccess("Account created. Redirecting to sign in…");
			setTimeout(() => navigate("/login"), 900);
		} catch (err) {
			setError(errorMessage(err, "Registration failed. Try a different email."));
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthLayout
			footer={
				<>
					Already have an account? <Link to="/login">Sign in</Link>
				</>
			}
			subtitle="Create an account to explore the pipeline."
			title="Create your account"
		>
			<form
				className="ap-form"
				onSubmit={onSubmit}
			>
				<label className="ap-field">
					<span className="ap-field-label">Email</span>
					<input
						autoComplete="email"
						className="ap-input"
						onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
						required
						type="email"
						value={form.email}
					/>
				</label>
				<label className="ap-field">
					<span className="ap-field-label">Password</span>
					<input
						autoComplete="new-password"
						className="ap-input"
						onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
						required
						type="password"
						value={form.password}
					/>
				</label>
				<ErrorBanner message={error} />
				<Notice tone="success">{success}</Notice>
				<Button
					className="is-block"
					disabled={loading}
					type="submit"
					variant="primary"
				>
					{loading ? "Creating account…" : "Create account"}
				</Button>
			</form>
		</AuthLayout>
	);
}
