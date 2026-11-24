import { useEffect, useMemo, useState } from "react";
import { fetchRecentEvents, fetchStatus } from "../lib/api";

function metricValue(value, suffix = "") {
	if (value === null || value === undefined) {
		return "N/A";
	}
	return `${value}${suffix}`;
}

function statusTone(status) {
	return status === "connected" ? "good" : "warn";
}

function toIncidentSummary(events) {
	const byEntity = new Map();
	for (const event of events) {
		const existing = byEntity.get(event.entity_id);
		if (!existing || new Date(event.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
			byEntity.set(event.entity_id, event);
		}
	}
	return Array.from(byEntity.values()).slice(0, 6);
}

export default function Overview() {
	const [status, setStatus] = useState(null);
	const [events, setEvents] = useState([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);

	const load = async ({ silent = false } = {}) => {
		if (!silent) {
			setLoading(true);
		}
		try {
			const [statusData, eventsData] = await Promise.all([fetchStatus(), fetchRecentEvents(40)]);
			setStatus(statusData);
			setEvents(eventsData);
			setError("");
		} catch (err) {
			setError(err.response?.data?.detail || "Unable to load overview.");
		} finally {
			if (!silent) {
				setLoading(false);
			}
		}
	};

	useEffect(() => {
		load();
		const id = setInterval(() => load({ silent: true }), 2000);
		return () => clearInterval(id);
	}, []);

	const topFeed = useMemo(() => events.slice(0, 12), [events]);
	const recentIncidents = useMemo(() => toIncidentSummary(events), [events]);

	return (
		<div className="page-stack">
			<section className="page-header row-between">
				<div>
					<h1>Overview</h1>
					<p className="muted">
						Real-time ingestion pipeline visibility across producer, Kafka, consumer, and indexed knowledge.
					</p>
				</div>
				<button
					className="btn btn-ghost"
					onClick={() => load()}
					type="button"
				>
					Refresh
				</button>
			</section>

			{error && <p className="error-text">{error}</p>}

			<section className="metrics-strip">
				<article className="metric-item">
					<p className="caption">Consumer status</p>
					<p className={`metric-value status-${statusTone(status?.kafka_consumer_status)}`}>
						{status?.kafka_consumer_status || "unknown"}
					</p>
				</article>
				<article className="metric-item">
					<p className="caption">Events published</p>
					<p className="metric-value">{metricValue(status?.simulator_published)}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Events processed</p>
					<p className="metric-value">{metricValue(status?.events_processed)}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Indexed versions</p>
					<p className="metric-value">{metricValue(status?.indexed_versions_count)}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Ingestion failures</p>
					<p className="metric-value">{metricValue(status?.ingestion_failures)}</p>
				</article>
			</section>

			<section className="split-layout">
				<div className="surface">
					<div className="row-between">
						<h2>Live event feed</h2>
						<p className="caption pulse-dot">Auto-updating every 2s</p>
					</div>
					{loading && events.length === 0 && <p className="muted">Loading feed...</p>}
					{!loading && topFeed.length === 0 && <p className="muted">No events observed yet.</p>}
					<div className="feed-list">
						{topFeed.map((event, index) => (
							<article
								className="feed-item"
								key={`${event.kind}-${event.event_id || event.knowledge_version_id || index}`}
							>
								<div className="feed-head">
									<p>
										<strong>{event.entity_id}</strong> · {event.event_type || event.kind}
									</p>
									<span className="chip">{event.ingestion_status}</span>
								</div>
								<p className="caption">
									{event.service || "service: n/a"} · severity: {event.severity || "n/a"} · status: {event.status || "n/a"}
								</p>
								{event.description && <p>{event.description}</p>}
								<p className="caption">
									event_time: {event.event_time || "n/a"} · ingested: {event.timestamp}
								</p>
							</article>
						))}
					</div>
				</div>

				<div className="surface">
					<h2>Recent incidents</h2>
					<p className="caption">Latest known state snapshot by incident ID.</p>
					<div className="incident-list">
						{recentIncidents.map((incident) => (
							<article
								className="incident-row"
								key={`${incident.entity_id}-${incident.timestamp}`}
							>
								<div>
									<p>
										<strong>{incident.entity_id}</strong>
									</p>
									<p className="caption">
										{incident.service || "service: n/a"} · {incident.severity || "severity: n/a"}
									</p>
								</div>
								<div>
									<p>{incident.status || incident.event_type || "unknown"}</p>
									<p className="caption">{incident.timestamp}</p>
								</div>
							</article>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
