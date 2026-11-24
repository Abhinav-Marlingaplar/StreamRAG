import { useEffect, useState } from "react";
import {
	fetchSimulatorStreamStatus,
	fetchStatus,
	publishDemoEvents,
	startSimulatorStream,
	stopSimulatorStream,
} from "../lib/api";

export default function Simulator() {
	const [status, setStatus] = useState(null);
	const [pipeline, setPipeline] = useState(null);
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
			const [stream, pipelineStatus] = await Promise.all([fetchSimulatorStreamStatus(), fetchStatus()]);
			setStatus(stream);
			setPipeline(pipelineStatus);
		} catch (err) {
			if (!silent) {
				setError(err.response?.data?.detail || "Unable to load simulator status.");
			}
		}
	};

	useEffect(() => {
		load();
		const id = setInterval(() => load({ silent: true }), 2000);
		return () => clearInterval(id);
	}, []);

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
				<p className="muted">
					Stream CSV-backed operational events into Kafka, monitor ingestion flow, and replay for interview demos.
				</p>
			</section>

			{error && <p className="error-text">{error}</p>}
			{success && <p className="success-text">{success}</p>}

			<section className="surface stack-gap">
				<div className="row-between">
					<h2>Streaming controls</h2>
					<span className={`chip ${status?.running ? "chip-live" : ""}`}>{status?.running ? "Live" : "Stopped"}</span>
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
						<span className="field-label">Max events (optional)</span>
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
						<span>Replay when CSV ends</span>
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
						Run JSON demo burst
					</button>
				</div>
			</section>

			<section className="metrics-strip">
				<article className="metric-item">
					<p className="caption">Published (current stream)</p>
					<p className="metric-value">{status?.published_count ?? 0}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Failed (current stream)</p>
					<p className="metric-value">{status?.failed_count ?? 0}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Processed (consumer)</p>
					<p className="metric-value">{pipeline?.events_processed ?? 0}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Ingestion failures</p>
					<p className="metric-value">{pipeline?.ingestion_failures ?? 0}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Last event id</p>
					<p className="metric-value metric-small">{status?.last_event_id || "n/a"}</p>
				</article>
			</section>

			<section className="surface stack-gap">
				<h2>Live status</h2>
				<p className="caption">CSV source: {status?.source_path || "simulator/operational_events.csv"}</p>
				<p className="caption">
					interval={status?.interval_seconds ?? intervalSeconds}s · loop={String(status?.loop ?? loop)} · max_events=
					{status?.max_events ?? "none"}
				</p>
				{status?.last_error && <p className="error-text">Last stream error: {status.last_error}</p>}
			</section>
		</div>
	);
}
