import { useEffect, useMemo, useState } from "react";
import {
	fetchRecentEvents,
	fetchSimulatorStreamStatus,
	fetchStatus,
	publishDemoEvents,
	startSimulatorStream,
	stopSimulatorStream,
} from "../lib/api";

function byMostRecent(a, b) {
	return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

export default function Simulator() {
	const [status, setStatus] = useState(null);
	const [pipeline, setPipeline] = useState(null);
	const [events, setEvents] = useState([]);
	const [intervalSeconds, setIntervalSeconds] = useState(2.5);
	const [loop, setLoop] = useState(true);
	const [maxEvents, setMaxEvents] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [loadingAction, setLoadingAction] = useState(false);

	const load = async ({ silent = false } = {}) => {
		if (!silent) {
			setError("");
		}
		try {
			const [stream, pipelineStatus, recentEvents] = await Promise.all([
				fetchSimulatorStreamStatus(),
				fetchStatus(),
				fetchRecentEvents(60),
			]);
			setStatus(stream);
			setPipeline(pipelineStatus);
			setEvents(recentEvents);
		} catch (err) {
			if (!silent) {
				setError(err.response?.data?.detail || "Unable to load simulator status.");
			}
		}
	};

	useEffect(() => {
		load();
		const id = setInterval(() => load({ silent: true }), 2200);
		return () => clearInterval(id);
	}, []);

	const recentPublished = useMemo(() => {
		return events
			.filter((event) => event.kind === "raw_event" && event.source && event.source.includes("simulator"))
			.sort(byMostRecent)
			.slice(0, 10);
	}, [events]);

	const startStreaming = async () => {
		setLoadingAction(true);
		setError("");
		setSuccess("");
		try {
			const payload = {
				source_mode: "csv",
				interval_seconds: Number(intervalSeconds) || 2.5,
				loop,
				max_events: maxEvents ? Number(maxEvents) : null,
			};
			const response = await startSimulatorStream(payload);
			setSuccess(response.detail);
			await load({ silent: true });
		} catch (err) {
			setError(err.response?.data?.detail || "Failed to start simulator stream.");
		} finally {
			setLoadingAction(false);
		}
	};

	const stopStreaming = async () => {
		setLoadingAction(true);
		setError("");
		setSuccess("");
		try {
			const response = await stopSimulatorStream();
			setSuccess(response.detail);
			await load({ silent: true });
		} catch (err) {
			setError(err.response?.data?.detail || "Failed to stop simulator stream.");
		} finally {
			setLoadingAction(false);
		}
	};

	const runJsonDemoBurst = async () => {
		setLoadingAction(true);
		setError("");
		setSuccess("");
		try {
			const response = await publishDemoEvents(true);
			setSuccess(`Published ${response.published_count} demo JSON events.`);
			await load({ silent: true });
		} catch (err) {
			setError(err.response?.data?.detail || "Failed to run demo publish.");
		} finally {
			setLoadingAction(false);
		}
	};

	return (
		<div className="page-stack">
			<section className="page-header">
				<h1>Event Simulator</h1>
				<p className="muted">Start a stream, watch incidents publish, and verify consumer processing in real time.</p>
			</section>

			{error && <p className="error-text">{error}</p>}
			{success && <p className="success-text">{success}</p>}

			<section className="surface stack-gap">
				<div className="row-between">
					<h2>Stream controls</h2>
					<span className={`chip ${status?.running ? "chip-live" : ""}`}>{status?.running ? "Streaming" : "Stopped"}</span>
				</div>
				<div className="sim-grid">
					<label className="field">
						<span className="field-label">Publishing interval (seconds)</span>
						<input
							className="input"
							min={0}
							onChange={(e) => setIntervalSeconds(e.target.value)}
							step="0.5"
							type="number"
							value={intervalSeconds}
						/>
					</label>
					<label className="field">
						<span className="field-label">Maximum events (optional)</span>
						<input
							className="input"
							min={1}
							onChange={(e) => setMaxEvents(e.target.value)}
							placeholder="Unlimited"
							type="number"
							value={maxEvents}
						/>
					</label>
					<label className="field field-toggle">
						<input
							checked={loop}
							onChange={(e) => setLoop(e.target.checked)}
							type="checkbox"
						/>
						<span>Replay CSV after completion</span>
					</label>
				</div>
				<div className="row">
					<button
						className="btn btn-primary"
						disabled={loadingAction || status?.running}
						onClick={startStreaming}
						type="button"
					>
						Start CSV stream
					</button>
					<button
						className="btn btn-ghost"
						disabled={loadingAction || !status?.running}
						onClick={stopStreaming}
						type="button"
					>
						Stop stream
					</button>
					<button
						className="btn btn-ghost"
						disabled={loadingAction}
						onClick={runJsonDemoBurst}
						type="button"
					>
						JSON demo burst
					</button>
				</div>
			</section>

			<section className="overview-summary">
				<article className="metric-item">
					<p className="caption">Events published</p>
					<p className="metric-value">{status?.published_count ?? 0}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Events processed</p>
					<p className="metric-value">{pipeline?.events_processed ?? 0}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Failed events</p>
					<p className="metric-value">{(status?.failed_count ?? 0) + (pipeline?.ingestion_failures ?? 0)}</p>
				</article>
			</section>

			<section className="surface stack-gap">
				<div className="row-between">
					<h2>Recently published events</h2>
					<p className="caption">From active simulator stream and recent demo bursts.</p>
				</div>
				{recentPublished.length === 0 && <p className="muted">No published events observed yet.</p>}
				<div className="feed-list">
					{recentPublished.map((event) => (
						<article
							className="feed-item"
							key={event.event_id}
						>
							<div className="feed-head">
								<p>
									<strong>{event.entity_id}</strong> · {event.event_type}
								</p>
								<span className={`chip ${event.ingestion_status === "indexed_with_embedding" ? "chip-live" : ""}`}>
									{event.ingestion_status}
								</span>
							</div>
							{event.description && <p>{event.description}</p>}
							<div className="row">
								{event.status && <span className="caption">{String(event.status).replaceAll("_", " ")}</span>}
								{event.service && <span className="caption">{event.service}</span>}
								{event.severity && <span className="caption">severity {event.severity}</span>}
							</div>
							<p className="caption">{event.event_time || event.timestamp}</p>
						</article>
					))}
				</div>
			</section>
		</div>
	);
}
