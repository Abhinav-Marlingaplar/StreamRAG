import { useRef, useState } from "react";
import { Icon } from "./icons";
import { copyText } from "../landing/hooks";

export function PageHeader({ title, description, actions }) {
	return (
		<header className="ap-page-head">
			<div>
				<h1>{title}</h1>
				{description && <p>{description}</p>}
			</div>
			{actions && <div className="ap-page-actions">{actions}</div>}
		</header>
	);
}

export function StatusDot({ tone = "neutral", pulse = false, label }) {
	return (
		<span
			aria-label={label}
			className={`ap-dot is-${tone} ${pulse ? "is-pulse" : ""}`}
			role={label ? "img" : undefined}
		/>
	);
}

export function Badge({ tone = "neutral", children, mono = false }) {
	return <span className={`ap-badge is-${tone} ${mono ? "is-mono" : ""}`}>{children}</span>;
}

export function Button({ variant = "ghost", size = "md", icon, children, className = "", ...props }) {
	return (
		<button
			className={`ap-btn ap-btn-${variant} ap-btn-${size} ${className}`}
			type="button"
			{...props}
		>
			{icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
			{children}
		</button>
	);
}

export function CopyButton({ text, label = "Copy" }) {
	const [copied, setCopied] = useState(false);
	const timer = useRef(0);
	return (
		<button
			className={`ap-btn ap-btn-ghost ap-btn-sm ${copied ? "is-copied" : ""}`}
			onClick={async () => {
				if (!(await copyText(text))) return;
				setCopied(true);
				clearTimeout(timer.current);
				timer.current = setTimeout(() => setCopied(false), 1500);
			}}
			type="button"
		>
			<Icon
				name={copied ? "check" : "copy"}
				size={14}
			/>
			{copied ? "Copied" : label}
		</button>
	);
}

export function ErrorBanner({ message, onRetry }) {
	if (!message) return null;
	return (
		<div
			className="ap-banner is-error"
			role="alert"
		>
			<span>{message}</span>
			{onRetry && (
				<Button
					onClick={onRetry}
					size="sm"
				>
					Retry
				</Button>
			)}
		</div>
	);
}

export function Notice({ tone = "info", children }) {
	if (!children) return null;
	return (
		<div
			className={`ap-banner is-${tone}`}
			role="status"
		>
			{children}
		</div>
	);
}

export function EmptyState({ icon = "stream", title, children, action }) {
	return (
		<div className="ap-empty">
			<span className="ap-empty-icon">
				<Icon
					name={icon}
					size={20}
				/>
			</span>
			<p className="ap-empty-title">{title}</p>
			{children && <p className="ap-empty-body">{children}</p>}
			{action}
		</div>
	);
}

export function Skeleton({ rows = 5 }) {
	return (
		<div
			aria-busy="true"
			aria-label="Loading"
			className="ap-skeleton"
		>
			{Array.from({ length: rows }).map((_, index) => (
				<span
					key={index}
					style={{ animationDelay: `${index * 0.08}s` }}
				/>
			))}
		</div>
	);
}

// Three real pipeline stages. A stage is only "done" when backend data proves it.
export function StageTrack({ event, compact = false }) {
	const published = Boolean(event.published_at);
	const persisted = Boolean(event.ingested_at);
	const indexed = event.stage === "indexed";
	const steps = [
		{
			key: "published",
			label: "Kafka",
			state: published ? "done" : persisted ? "unknown" : "active",
			title: published ? "Published to Kafka (broker acknowledged)" : "Publish not recorded by this API process",
		},
		{
			key: "persisted",
			label: "Persisted",
			state: persisted ? "done" : "active",
			title: persisted ? "Raw event and knowledge version written to PostgreSQL" : "Waiting for the consumer to persist it",
		},
		{
			key: "indexed",
			label: "Indexed",
			state: indexed ? "done" : persisted ? "active" : "idle",
			title: indexed ? "Embedding stored in pgvector" : persisted ? "Waiting for the embedding to be stored" : "Not reached yet",
		},
	];
	return (
		<ol
			aria-label="Processing stages"
			className={`ap-track ${compact ? "is-compact" : ""}`}
		>
			{steps.map((step) => (
				<li
					className={`ap-track-step is-${step.state}`}
					key={step.key}
					title={step.title}
				>
					<i />
					{!compact && <span>{step.label}</span>}
				</li>
			))}
		</ol>
	);
}

export function stageSummary(event) {
	if (event.duplicate) return { tone: "neutral", label: "Duplicate · skipped" };
	if (event.stage === "indexed") return { tone: "green", label: "Complete" };
	if (event.stage === "persisted") return { tone: "blue", label: "Indexing…" };
	return { tone: "amber", label: "Awaiting consumer" };
}
