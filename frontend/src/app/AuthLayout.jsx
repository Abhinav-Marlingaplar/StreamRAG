import { Link } from "react-router-dom";
import { Logo } from "../landing/ui";
import "./app.css";

export default function AuthLayout({ title, subtitle, children, footer }) {
	return (
		<div className="ap-auth">
			<div
				aria-hidden
				className="ap-auth-glow"
			/>
			<div className="ap-auth-card">
				<Link
					className="ap-brand"
					to="/"
				>
					<Logo size={34} />
					<span>StreamRAG</span>
				</Link>
				<div className="ap-auth-head">
					<h1>{title}</h1>
					<p>{subtitle}</p>
				</div>
				{children}
				<p className="ap-auth-foot">{footer}</p>
			</div>
		</div>
	);
}
