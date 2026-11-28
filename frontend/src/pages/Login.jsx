import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../app/AuthLayout";
import { Button, ErrorBanner } from "../app/ui";
import { loginUser, setAuthToken } from "../lib/api";
import { errorMessage } from "../lib/format";

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
			setError(errorMessage(err, "Sign in failed. Please try again."));
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthLayout
			footer={
				<>
					New to StreamRAG? <Link to="/register">Create an account</Link>
				</>
			}
			subtitle="Sign in to the StreamRAG workspace."
			title="Welcome back"
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
						autoComplete="current-password"
						className="ap-input"
						onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
						required
						type="password"
						value={form.password}
					/>
				</label>
				<ErrorBanner message={error} />
				<Button
					className="is-block"
					disabled={loading}
					type="submit"
					variant="primary"
				>
					{loading ? "Signing in…" : "Sign in"}
				</Button>
			</form>
		</AuthLayout>
	);
}
