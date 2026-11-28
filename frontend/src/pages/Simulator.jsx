import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePipeline } from "../app/PipelineContext";
import { Icon } from "../app/icons";
import { Badge, Button, ErrorBanner, Notice, PageHeader, StageTrack, StatusDot, stageSummary } from "../app/ui";
import { publishCustomEvent, publishDemoEvents, startSimulatorStream, stopSimulatorStream } from "../lib/api";
import {
	EVENT_TYPE_LABEL,
	STATUS_OPTIONS,
	errorMessage,
	formatClock,
	humanize,
	newEventId,
	newIncidentId,
	statusTone,
} from "../lib/format";

const INTERVAL_PRESETS = [0.5, 1, 2.5, 5];
const SEVERITIES = ["P1", "P2", "P3", "P4"];
const DEFAULT_STATUS = {
	incident_created: "investigating",
	incident_updated: "root_cause_identified",
	incident_resolved: "resolved",
};

const SCENARIOS = [
	{
		service: "checkout-api",
		severity: "P1",
		created: "Elevated error rate and latency on checkout-api affecting live traffic.",
		cause: "database connection pool exhaustion",
		updated: "Root cause isolated to connection pool saturation after a burst of long-running queries.",
		mitigation: "increased pool size and restarted overloaded pods",
		resolved: "Error rates back to baseline; incident closed after stable behaviour.",
	},
	{
		service: "payments-gateway",
		severity: "P2",
		created: "Intermittent payment authorisation timeouts reported by multiple merchants.",
		cause: "retry storm after upstream dependency timeout",
		updated: "Retry storm identified; upstream provider degraded and clients retrying aggressively.",
		mitigation: "introduced jittered retries and a circuit breaker",
		resolved: "Authorisation latency recovered and queues drained.",
	},
	{
		service: "search-indexer",
		severity: "P3",
		created: "Search results are stale; indexing lag is growing.",
		cause: "consumer group rebalance loop",
		updated: "Indexer stuck in a rebalance loop after a bad deploy.",
		mitigation: "rolled back the deploy and pinned the consumer group",
		resolved: "Index caught up and freshness is within target.",
	},
];

const isoMinutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

function blankEvent() {
	return {
		entity_id: newIncidentId(),
		event_type: "incident_created",
		status: "investigating",
		service: "checkout-api",
		severity: "P2",
		description: "",
		root_cause: "",
		mitigation: "",
		event_time: "",
	};
}

function buildPayload(form) {
	const payload = { status: form.status };
	for (const key of ["service", "severity", "description", "root_cause", "mitigation"]) {
		const value = String(form[key] || "").trim();
		if (value) payload[key] = value;
	}
	return payload;
}

function Field({ label, hint, children, wide }) {
	return (
		<label className={`ap-field ${wide ? "is-wide" : ""}`}>
			<span className="ap-field-label">{label}</span>
			{children}
			{hint && <span className="ap-field-hint">{hint}</span>}
		</label>
	);
}

export default function Simulator() {
	const { stream, events, refresh } = usePipeline();
	const [interval, setIntervalValue] = useState("2.5");
	const [maxEvents, setMaxEvents] = useState("");
	const [loop, setLoop] = useState(false);
	const [busy, setBusy] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [form, setForm] = useState(blankEvent);
	const [sent, setSent] = useState([]);

	const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
	const incidentOptions = useMemo(() => [...new Set(events.map((event) => event.entity_id))].slice(0, 12), [events]);
	const idValid = /^INC-\d+$/i.test(form.entity_id.trim());

	const run = async (name, action) => {
		setBusy(name);
		setError("");
		setNotice("");
		try {
			await action();
			await refresh();
		} catch (err) {
			setError(errorMessage(err, "Request failed."));
		} finally {
			setBusy("");
		}
	};

	const remember = (records) =>
		setSent((prev) => [...records.reverse(), ...prev].filter((item, index, all) => all.findIndex((x) => x.event_id === item.event_id) === index).slice(0, 6));

	const startStream = () =>
		run("start", async () => {
			const response = await startSimulatorStream({
				source_mode: "csv",
				interval_seconds: Number(interval) >= 0 ? Number(interval) : 2.5,
				loop,
				max_events: maxEvents ? Number(maxEvents) : null,
			});
			setNotice(response.detail);
		});

	const stopStream = () =>
		run("stop", async () => {
			const response = await stopSimulatorStream();
			setNotice(response.detail);
		});

	const runDemo = () =>
		run("demo", async () => {
			const response = await publishDemoEvents(true);
			setNotice(
				`Published ${response.published_count} scenario events to ${response.topic}. Events already ingested are skipped by the worker.`
			);
		});

	const publishOne = (event) => {
		event.preventDefault();
		if (!idValid) return;
		run("publish", async () => {
			const eventId = newEventId();
			const eventTime = form.event_time ? new Date(form.event_time).toISOString() : null;
			const payload = buildPayload(form);
			await publishCustomEvent({
				event_id: eventId,
				entity_id: form.entity_id.trim().toUpperCase(),
				event_type: form.event_type,
				payload,
				source: "simulator-ui",
				event_time: eventTime,
			});
			remember([
				{
					event_id: eventId,
					entity_id: form.entity_id.trim().toUpperCase(),
					event_type: form.event_type,
					event_time: eventTime || new Date().toISOString(),
					source: "simulator-ui",
					payload,
					published_at: new Date().toISOString(),
					publish_count: 1,
					stage: "published",
				},
			]);
			setNotice(`Published ${form.entity_id.trim().toUpperCase()} · ${EVENT_TYPE_LABEL[form.event_type]} to operations-events.`);
			if (form.event_type === "incident_created") {
				setForm((prev) => ({ ...prev, event_type: "incident_updated", status: DEFAULT_STATUS.incident_updated }));
			}
		});
	};

	const publishLifecycle = () =>
		run("lifecycle", async () => {
			const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
			const entityId = newIncidentId();
			const steps = [
				["incident_created", "investigating", 10, scenario.created],
				["incident_updated", "root_cause_identified", 5, scenario.updated],
				["incident_resolved", "resolved", 0, scenario.resolved],
			];
			const records = [];
			for (const [eventType, status, minutesAgo, description] of steps) {
				const eventId = newEventId();
				const eventTime = isoMinutesAgo(minutesAgo);
				const payload = {
					status,
					service: scenario.service,
					severity: scenario.severity,
					description,
					...(status !== "investigating" ? { root_cause: scenario.cause, mitigation: scenario.mitigation } : {}),
				};
				await publishCustomEvent({
					event_id: eventId,
					entity_id: entityId,
					event_type: eventType,
					payload,
					source: "simulator-ui",
					event_time: eventTime,
				});
				records.push({
					event_id: eventId,
					entity_id: entityId,
					event_type: eventType,
					event_time: eventTime,
					source: "simulator-ui",
					payload,
					published_at: new Date().toISOString(),
					publish_count: 1,
					stage: "published",
				});
			}
			remember(records);
			setForm((prev) => ({ ...prev, entity_id: entityId }));
			setNotice(`Published a 3-event lifecycle for ${entityId} (created → updated → resolved).`);
		});

	const sentRows = sent.map((local) => events.find((event) => event.event_id === local.event_id) || local);
	const running = Boolean(stream?.running);

	return (
		<div className="ap-page">
			<PageHeader
				actions={
					<Link
						className="ap-btn ap-btn-ghost ap-btn-sm"
						to="/app/stream"
					>
						<Icon
							name="stream"
							size={14}
						/>
						Watch event stream
					</Link>
				}
				description="Generate operational events and publish them to Kafka. Everything here goes through the real pipeline."
				title="Event Simulator"
			/>

			<ErrorBanner message={error} />
			<Notice tone="success">{notice}</Notice>

			<div className="ap-split">
				<section className="ap-panel">
					<div className="ap-panel-head">
						<div>
							<h2>Dataset stream</h2>
							<p>Replays operational_events.csv into Kafka at a steady pace.</p>
						</div>
						<span className={`ap-state ${running ? "is-live" : ""}`}>
							<StatusDot
								pulse={running}
								tone={running ? "green" : "neutral"}
							/>
							{running ? "Streaming" : "Stopped"}
						</span>
					</div>

					<div className="ap-form">
						<Field label="Publish interval (seconds)">
							<div className="ap-inline">
								<input
									className="ap-input"
									disabled={running}
									min={0}
									onChange={(event) => setIntervalValue(event.target.value)}
									step="0.5"
									type="number"
									value={interval}
								/>
								<div
									className="ap-segment is-small"
									role="group"
								>
									{INTERVAL_PRESETS.map((preset) => (
										<button
											aria-pressed={Number(interval) === preset}
											className={Number(interval) === preset ? "is-active" : ""}
											disabled={running}
											key={preset}
											onClick={() => setIntervalValue(String(preset))}
											type="button"
										>
											{preset}s
										</button>
									))}
								</div>
							</div>
						</Field>
						<Field
							hint="Leave empty to run until stopped."
							label="Maximum events"
						>
							<input
								className="ap-input"
								disabled={running}
								min={1}
								onChange={(event) => setMaxEvents(event.target.value)}
								placeholder="Unlimited"
								type="number"
								value={maxEvents}
							/>
						</Field>
						<label className="ap-switch">
							<input
								checked={loop}
								disabled={running}
								onChange={(event) => setLoop(event.target.checked)}
								type="checkbox"
							/>
							<span />
							<div>
								<strong>Replay when finished</strong>
								<small>Events already ingested are skipped (idempotent by event_id), so replays add nothing new.</small>
							</div>
						</label>
					</div>

					<div className="ap-actions">
						{running ? (
							<Button
								disabled={busy === "stop"}
								icon="stop"
								onClick={stopStream}
								variant="danger"
							>
								Stop stream
							</Button>
						) : (
							<Button
								disabled={busy === "start"}
								icon="play"
								onClick={startStream}
								variant="primary"
							>
								{busy === "start" ? "Starting…" : "Start stream"}
							</Button>
						)}
						<Button
							disabled={busy === "demo"}
							onClick={runDemo}
						>
							{busy === "demo" ? "Publishing…" : "Publish INC-1024 scenario"}
						</Button>
					</div>

					{stream && (stream.running || stream.started_at) && (
						<dl className="ap-stats">
							<div>
								<dt>Published</dt>
								<dd>{stream.published_count}</dd>
							</div>
							<div>
								<dt>Failed</dt>
								<dd className={stream.failed_count ? "is-red" : ""}>{stream.failed_count}</dd>
							</div>
							<div>
								<dt>Last event</dt>
								<dd className="ap-mono">{stream.last_event_id || "—"}</dd>
							</div>
							<div>
								<dt>Started</dt>
								<dd>{stream.started_at ? formatClock(stream.started_at) : "—"}</dd>
							</div>
						</dl>
					)}
					{stream?.last_error && <p className="ap-error-text">Last error: {stream.last_error}</p>}
				</section>

				<section className="ap-panel">
					<div className="ap-panel-head">
						<div>
							<h2>Compose an event</h2>
							<p>Publish a single incident event, or a whole lifecycle.</p>
						</div>
					</div>

					<form
						className="ap-form"
						onSubmit={publishOne}
					>
						<div className="ap-grid-2">
							<Field
								hint={idValid ? undefined : "Use the format INC-1234"}
								label="Incident ID"
							>
								<div className="ap-inline">
									<input
										className={`ap-input ${idValid ? "" : "is-invalid"}`}
										list="incident-ids"
										onChange={update("entity_id")}
										value={form.entity_id}
									/>
									<datalist id="incident-ids">
										{incidentOptions.map((id) => (
											<option
												key={id}
												value={id}
											/>
										))}
									</datalist>
									<button
										aria-label="Generate a new incident ID"
										className="ap-icon-btn"
										onClick={() => setForm((prev) => ({ ...prev, entity_id: newIncidentId(), event_type: "incident_created", status: "investigating" }))}
										title="New incident ID"
										type="button"
									>
										<Icon name="dice" />
									</button>
								</div>
							</Field>
							<Field label="Event type">
								<select
									className="ap-input"
									onChange={(event) =>
										setForm((prev) => ({
											...prev,
											event_type: event.target.value,
											status: DEFAULT_STATUS[event.target.value],
										}))
									}
									value={form.event_type}
								>
									{Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
										<option
											key={value}
											value={value}
										>
											{label} ({value})
										</option>
									))}
								</select>
							</Field>
							<Field label="Status">
								<select
									className="ap-input"
									onChange={update("status")}
									value={form.status}
								>
									{STATUS_OPTIONS.map((value) => (
										<option
											key={value}
											value={value}
										>
											{humanize(value)}
										</option>
									))}
								</select>
							</Field>
							<Field label="Severity">
								<select
									className="ap-input"
									onChange={update("severity")}
									value={form.severity}
								>
									{SEVERITIES.map((value) => (
										<option key={value}>{value}</option>
									))}
								</select>
							</Field>
							<Field label="Service">
								<input
									className="ap-input"
									onChange={update("service")}
									value={form.service}
								/>
							</Field>
							<Field
								hint="Empty = now (UTC). Use a past time to test as-of queries."
								label="Event time"
							>
								<input
									className="ap-input"
									onChange={update("event_time")}
									type="datetime-local"
									value={form.event_time}
								/>
							</Field>
						</div>
						<Field
							label="Description"
							wide
						>
							<textarea
								className="ap-input"
								onChange={update("description")}
								placeholder="What is happening?"
								rows={2}
								value={form.description}
							/>
						</Field>
						<div className="ap-grid-2">
							<Field label="Root cause (optional)">
								<input
									className="ap-input"
									onChange={update("root_cause")}
									value={form.root_cause}
								/>
							</Field>
							<Field label="Mitigation (optional)">
								<input
									className="ap-input"
									onChange={update("mitigation")}
									value={form.mitigation}
								/>
							</Field>
						</div>
						<div className="ap-actions">
							<Button
								disabled={!idValid || busy === "publish"}
								icon="send"
								type="submit"
								variant="primary"
							>
								{busy === "publish" ? "Publishing…" : "Publish event"}
							</Button>
							<Button
								disabled={busy === "lifecycle"}
								onClick={publishLifecycle}
							>
								{busy === "lifecycle" ? "Publishing…" : "Generate full lifecycle"}
							</Button>
						</div>
					</form>
				</section>
			</div>

			{sentRows.length > 0 && (
				<section className="ap-section">
					<div className="ap-section-head">
						<h2>Just published</h2>
						<Link
							className="ap-link"
							to="/app/stream"
						>
							Inspect in Event Stream
							<Icon
								name="arrow"
								size={14}
							/>
						</Link>
					</div>
					<ul className="ap-sent">
						{sentRows.map((event) => {
							const summary = stageSummary(event);
							return (
								<li key={event.event_id}>
									<span className="ap-strong">{event.entity_id}</span>
									<Badge tone="neutral">{EVENT_TYPE_LABEL[event.event_type] || humanize(event.event_type)}</Badge>
									{event.payload?.status && <Badge tone={statusTone(event.payload.status)}>{humanize(event.payload.status)}</Badge>}
									<span className="ap-sent-track">
										<StageTrack event={event} />
									</span>
									<span className={`ap-feed-state is-${summary.tone}`}>{summary.label}</span>
								</li>
							);
						})}
					</ul>
				</section>
			)}
		</div>
	);
}
