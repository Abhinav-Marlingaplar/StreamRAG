import { useEffect, useMemo, useState } from "react";
import { fetchRecentEvents, fetchStatus } from "../lib/api";

function formatMetric(value, suffix = "") {
	if (value === null || value === undefined) {
		return "N/A";
	}
	return `${value}${suffix}`;
}

export default function Dashboard() {
	const [status, setStatus] = useState(null);
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const loadData = async () => {
		setLoading(true);
		setError("");
		try {
			const [statusData, eventsData] = await Promise.all([fetchStatus(), fetchRecentEvents(15)]);
			setStatus(statusData);
			setEvents(eventsData);
		} catch (err) {
			setError(err.response?.data?.detail || "Unable to load dashboard data.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
		const id = setInterval(loadData, 8000);
		return () => clearInterval(id);
	}, []);

	const metricCards = useMemo(() => {
		if (!status) {
			return [];
		}
		return [
			{ label: "Consumer status", value: status.kafka_consumer_status },
			{ label: "Events processed", value: formatMetric(status.events_processed) },
			{ label: "Indexed versions", value: formatMetric(status.indexed_versions_count) },
			{ label: "Ingestion failures", value: formatMetric(status.ingestion_failures) },
			{ label: "Query latency", value: formatMetric(status.avg_query_latency_ms, " ms") },
			{ label: "Retrieval latency", value: formatMetric(status.avg_retrieval_latency_ms, " ms") },
			{ label: "LLM latency", value: formatMetric(status.avg_llm_latency_ms, " ms") },
		];
	}, [status]);

	return (
		<div className="page-stack">
			<section className="page-header row-between">
				<div>
					<h1>Dashboard</h1>
					<p className="muted">System health, throughput metrics, and latest stream activity in one place.</p>
				</div>
				<button
					className="btn btn-ghost"
					onClick={loadData}
					type="button"
				>
					Refresh
				</button>
			</section>

			{error && <p className="error-text">{error}</p>}

			<section className="metrics-grid">
				{loading && !status && <p className="muted">Loading status metrics...</p>}
				{metricCards.map((metric) => (
					<article
						className="metric-card"
						key={metric.label}
					>
						<p className="caption">{metric.label}</p>
						<p className="metric-value">{metric.value}</p>
					</article>
				))}
			</section>

			<section className="panel stack">
				<h2>Recent activity</h2>
				{loading && events.length === 0 && <p className="muted">Loading event feed...</p>}
				{!loading && events.length === 0 && <p className="muted">No events received yet.</p>}
				{events.map((event, index) => (
					<article
						className="event-row"
						key={`${event.kind}-${event.event_id || event.knowledge_version_id || index}`}
					>
						<div>
							<p>
								<strong>{event.entity_id}</strong> · {event.kind}
							</p>
							<p className="caption">{event.event_type || event.status || "unknown"}</p>
						</div>
						<p className="caption">{event.timestamp}</p>
					</article>
				))}
			</section>
		</div>
	);
}
