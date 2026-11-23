import { useEffect, useState } from "react";
import { fetchStatus } from "../lib/api";

function statusTone(status) {
	if (!status) return "tone-neutral";
	return status === "connected" ? "tone-good" : "tone-warn";
}

export default function Monitoring() {
	const [status, setStatus] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const loadStatus = async () => {
		setLoading(true);
		setError("");
		try {
			const data = await fetchStatus();
			setStatus(data);
		} catch (err) {
			setError(err.response?.data?.detail || "Monitoring data unavailable.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadStatus();
		const id = setInterval(loadStatus, 6000);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="page-stack">
			<section className="page-header row-between">
				<div>
					<h1>Monitoring</h1>
					<p className="muted">Observe consumer health, ingestion reliability, and response latency in real time.</p>
				</div>
				<button
					className="btn btn-ghost"
					onClick={loadStatus}
					type="button"
				>
					Refresh
				</button>
			</section>

			{error && <p className="error-text">{error}</p>}

			{loading && !status && <p className="muted">Loading monitoring signals...</p>}

			{status && (
				<section className="monitor-grid">
					<article className={`panel ${statusTone(status.kafka_consumer_status)}`}>
						<h3>Consumer state</h3>
						<p className="metric-value">{status.kafka_consumer_status}</p>
					</article>
					<article className="panel">
						<h3>Ingestion failures</h3>
						<p className="metric-value">{status.ingestion_failures}</p>
					</article>
					<article className="panel">
						<h3>Indexed versions</h3>
						<p className="metric-value">{status.indexed_versions_count}</p>
					</article>
					<article className="panel">
						<h3>Events processed</h3>
						<p className="metric-value">{status.events_processed}</p>
					</article>
					<article className="panel">
						<h3>Avg query latency</h3>
						<p className="metric-value">{status.avg_query_latency_ms ?? "N/A"} ms</p>
					</article>
					<article className="panel">
						<h3>Avg retrieval latency</h3>
						<p className="metric-value">{status.avg_retrieval_latency_ms ?? "N/A"} ms</p>
					</article>
					<article className="panel">
						<h3>Avg LLM latency</h3>
						<p className="metric-value">{status.avg_llm_latency_ms ?? "N/A"} ms</p>
					</article>
				</section>
			)}
		</div>
	);
}
