import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./icons";
import { Badge, CopyButton, StageTrack, stageSummary } from "./ui";
import {
	EVENT_TYPE_LABEL,
	formatClock,
	formatDuration,
	formatUtc,
	humanize,
	pipelineLatency,
	statusTone,
} from "../lib/format";

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

export function JsonView({ value }) {
	const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
	const nodes = [];
	let last = 0;
	let match;
	TOKEN.lastIndex = 0;
	while ((match = TOKEN.exec(text)) !== null) {
		if (match.index > last) nodes.push(text.slice(last, match.index));
		const [token, str, colon, literal] = match;
		let cls = "num";
		if (str) cls = colon ? "key" : "str";
		else if (literal) cls = "lit";
		nodes.push(
			<span
				className={`ap-json-${cls}`}
				key={match.index}
			>
				{str && colon ? str : token}
			</span>
		);
		if (str && colon) nodes.push(colon);
		last = match.index + token.length;
	}
	nodes.push(text.slice(last));
	return (
		<pre className="ap-json">
			<code>{nodes}</code>
		</pre>
	);
}

function envelope(event) {
	return {
		event_id: event.event_id,
		event_type: event.event_type,
		entity_id: event.entity_id,
		event_time: event.event_time,
		source: event.source,
		payload: event.payload,
	};
}

function Field({ label, children }) {
	if (children == null || children === "") return null;
	return (
		<div className="ap-field-row">
			<dt>{label}</dt>
			<dd>{children}</dd>
		</div>
	);
}

export default function EventDrawer({ event, onClose }) {
	const [tab, setTab] = useState("details");
	const closeRef = useRef(null);

	useEffect(() => {
		if (!event) return undefined;
		setTab("details");
		closeRef.current?.focus();
		const onKey = (keyEvent) => keyEvent.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [event?.event_id, onClose]);

	if (!event) return null;

	const payload = event.payload || {};
	const summary = stageSummary(event);
	const latency = pipelineLatency(event);
	const message = envelope(event);

	return (
		<div
			className="ap-drawer-layer"
			role="presentation"
		>
			<button
				aria-label="Close event details"
				className="ap-drawer-scrim"
				onClick={onClose}
				type="button"
			/>
			<aside
				aria-label={`Event ${event.event_id}`}
				aria-modal="true"
				className="ap-drawer"
				role="dialog"
			>
				<header className="ap-drawer-head">
					<div>
						<div className="ap-drawer-title">
							<strong>{event.entity_id}</strong>
							<Badge tone="neutral">{EVENT_TYPE_LABEL[event.event_type] || humanize(event.event_type)}</Badge>
							<Badge tone={summary.tone}>{summary.label}</Badge>
						</div>
						<p className="ap-drawer-id">
							<span>{event.event_id}</span>
						</p>
					</div>
					<button
						aria-label="Close"
						className="ap-icon-btn"
						onClick={onClose}
						ref={closeRef}
						type="button"
					>
						<Icon name="close" />
					</button>
				</header>

				<div className="ap-tabs">
					{[
						["details", "Details"],
						["json", "Message JSON"],
					].map(([id, label]) => (
						<button
							aria-selected={tab === id}
							className={tab === id ? "is-active" : ""}
							key={id}
							onClick={() => setTab(id)}
							role="tab"
							type="button"
						>
							{label}
						</button>
					))}
				</div>

				<div className="ap-drawer-body">
					{tab === "details" ? (
						<>
							<section className="ap-drawer-section">
								<h3>Processing</h3>
								<StageTrack event={event} />
								<dl className="ap-fields">
									<Field label="Published to Kafka">
										{event.published_at ? (
											<>
												{formatClock(event.published_at)}
												{event.publish_count > 1 && <span className="ap-muted"> · sent ×{event.publish_count}</span>}
											</>
										) : (
											<span className="ap-muted">Not recorded by this API process</span>
										)}
									</Field>
									<Field label="Persisted to PostgreSQL">
										{event.ingested_at ? formatClock(event.ingested_at) : <span className="ap-muted">Waiting for consumer…</span>}
									</Field>
									<Field label="Publish → persist">
										{latency != null ? formatDuration(latency) : null}
									</Field>
									<Field label="Embedding in pgvector">
										{event.stage === "indexed" ? "Stored" : event.ingested_at ? "Pending" : null}
									</Field>
								</dl>
								{event.duplicate && (
									<p className="ap-note">
										This event_id was already stored before it was published again, so the worker skipped it
										(ingestion is idempotent by event_id).
									</p>
								)}
								{!event.duplicate && event.publish_count > 1 && (
									<p className="ap-note">Later re-publishes of this event_id are skipped by the worker.</p>
								)}
							</section>

							<section className="ap-drawer-section">
								<h3>Event</h3>
								<dl className="ap-fields">
									<Field label="Status">
										{payload.status && <Badge tone={statusTone(payload.status)}>{humanize(payload.status)}</Badge>}
									</Field>
									<Field label="Service">{payload.service}</Field>
									<Field label="Severity">{payload.severity}</Field>
									<Field label="Source">{event.source}</Field>
									<Field label="Event time">{formatUtc(event.event_time)}</Field>
									<Field label="Description">{payload.description}</Field>
									<Field label="Root cause">{payload.root_cause}</Field>
									<Field label="Mitigation">{payload.mitigation}</Field>
								</dl>
							</section>

							{event.version && (
								<section className="ap-drawer-section">
									<h3>Knowledge version</h3>
									<dl className="ap-fields">
										<Field label="Version">
											v{event.version.version} · #{event.version.id}
										</Field>
										<Field label="Valid from">{formatUtc(event.version.valid_from)}</Field>
										<Field label="Valid to">
											{event.version.valid_to ? formatUtc(event.version.valid_to) : <Badge tone="green">current</Badge>}
										</Field>
									</dl>
									<Link
										className="ap-link"
										to={`/app/intelligence?entity=${encodeURIComponent(event.entity_id)}`}
									>
										Open {event.entity_id} timeline in Intelligence
										<Icon
											name="arrow"
											size={14}
										/>
									</Link>
								</section>
							)}
						</>
					) : (
						<section className="ap-drawer-section">
							<div className="ap-json-head">
								<p>Exactly as published to the operations-events topic.</p>
								<CopyButton text={JSON.stringify(message, null, 2)} />
							</div>
							<JsonView value={message} />
						</section>
					)}
				</div>
			</aside>
		</div>
	);
}
