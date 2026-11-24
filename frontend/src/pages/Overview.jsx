import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRecentEvents, fetchStatus } from "../lib/api";

function statusTone(status) {
	return status === "connected" ? "good" : "warn";
}

function formatStatus(value) {
	return String(value || "").replaceAll("_", " ");
}

function buildIncidentActivity(events) {
	const grouped = new Map();
	for (const event of events) {
		if (!event.entity_id) {
			continue;
		}
		const key = event.entity_id;
		const existing = grouped.get(key);
		const timestamp = new Date(event.event_time || event.timestamp).getTime();
		if (!existing) {
			grouped.set(key, {
				entity_id: key,
				latest: event,
				latest_time: timestamp,
				updates_count: 1,
				indexed_count: event.ingestion_status === "indexed_with_embedding" ? 1 : 0,
			});
			continue;
		}
		existing.updates_count += 1;
		if (event.ingestion_status === "indexed_with_embedding") {
			existing.indexed_count += 1;
		}
		if (timestamp >= existing.latest_time) {
			existing.latest = event;
			existing.latest_time = timestamp;
		}
	}

	return Array.from(grouped.values())
		.sort((a, b) => b.latest_time - a.latest_time)
		.slice(0, 14);
}

export default function Overview() {
	const [status, setStatus] = useState(null);
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = async ({ silent = false } = {}) => {
		if (!silent) {
			setLoading(true);
		}
		try {
			const [statusData, eventsData] = await Promise.all([fetchStatus(), fetchRecentEvents(80)]);
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
		const id = setInterval(() => load({ silent: true }), 2200);
		return () => clearInterval(id);
	}, []);

	const incidents = useMemo(() => buildIncidentActivity(events), [events]);

	return (
		<div className="page-stack">
			<section className="page-header row-between">
				<div>
					<h1>Overview</h1>
					<p className="muted">Understand what incidents are entering the system and how processing is progressing.</p>
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

			<section className="overview-summary">
				<article className="metric-item">
					<p className="caption">Consumer status</p>
					<p className={`metric-value status-${statusTone(status?.kafka_consumer_status)}`}>
						{status?.kafka_consumer_status || "unknown"}
					</p>
				</article>
				<article className="metric-item">
					<p className="caption">Events received/published</p>
					<p className="metric-value">{status?.simulator_published ?? 0}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Events processed</p>
					<p className="metric-value">{status?.events_processed ?? 0}</p>
				</article>
				<article className="metric-item">
					<p className="caption">Processing failures</p>
					<p className="metric-value">{status?.ingestion_failures ?? 0}</p>
				</article>
			</section>

			<section className="surface stack-gap">
				<div className="row-between">
					<h2>Incident activity</h2>
					<p className="caption pulse-dot">Live updates every ~2s</p>
				</div>
				{loading && incidents.length === 0 && <p className="muted">Loading incident activity...</p>}
				{!loading && incidents.length === 0 && <p className="muted">No incident activity yet.</p>}
				<div className="activity-list">
					{incidents.map((incident) => {
						const event = incident.latest;
						const statusLabel = formatStatus(event.status || event.event_type || event.kind);
						const stateLabel = incident.indexed_count > 0 ? "indexed" : "ingested";
						return (
							<article
								className="activity-row"
								key={incident.entity_id}
							>
								<div className="activity-main">
									<p className="activity-title">
										<strong>{incident.entity_id}</strong> · {statusLabel}
									</p>
									{event.description && <p>{event.description}</p>}
									<div className="row">
										{event.service && <span className="caption">{event.service}</span>}
										{event.severity && <span className="caption">severity {event.severity}</span>}
										<span className={`chip ${stateLabel === "indexed" ? "chip-live" : ""}`}>{stateLabel}</span>
										<span className="caption">{incident.updates_count} updates</span>
									</div>
									<p className="caption">{event.event_time || event.timestamp}</p>
								</div>
								<Link
									className="sidebar-link"
									to={`/app/intelligence?entity=${incident.entity_id}`}
								>
									Inspect timeline
								</Link>
							</article>
						);
					})}
				</div>
			</section>
		</div>
	);
}
