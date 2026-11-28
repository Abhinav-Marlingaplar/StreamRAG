import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePipeline } from "../app/PipelineContext";
import { Icon } from "../app/icons";
import { Badge, Button, EmptyState, ErrorBanner, PageHeader, Skeleton, StatusDot } from "../app/ui";
import { useNow } from "../lib/hooks";
import { formatDuration, humanize, statusTone, timeAgo } from "../lib/format";

function groupIncidents(events) {
	const byEntity = new Map();
	for (const event of events) {
		if (!event.ingested_at) continue;
		const group = byEntity.get(event.entity_id) || { entity_id: event.entity_id, events: [] };
		group.events.push(event);
		byEntity.set(event.entity_id, group);
	}
	return Array.from(byEntity.values())
		.map((group) => {
			const current =
				group.events.find((event) => event.version?.is_current) ||
				[...group.events].sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0];
			const lastIngested = Math.max(...group.events.map((event) => new Date(event.ingested_at).getTime()));
			return { ...group, current, updates: group.events.length, lastIngested };
		})
		.sort((a, b) => b.lastIngested - a.lastIngested);
}

function Metric({ label, value, sub, tone, children }) {
	return (
		<div className="ap-metric">
			<p className="ap-metric-label">{label}</p>
			<p className={`ap-metric-value ${tone ? `is-${tone}` : ""}`}>{children ?? value}</p>
			{sub && <p className="ap-metric-sub">{sub}</p>}
		</div>
	);
}

function PipelineMap({ status, stream, counts, error }) {
	const connected = status?.kafka_consumer_status === "connected";
	const awaiting = counts?.awaiting_index ?? 0;
	const nodes = [
		{
			key: "sim",
			title: "Simulator",
			sub: stream?.running ? `Streaming · ${stream.published_count} sent` : "Idle",
			tone: stream?.running ? "amber" : "neutral",
			pulse: stream?.running,
		},
		{ key: "kafka", title: "Kafka", sub: "operations-events", tone: "neutral" },
		{
			key: "worker",
			title: "Worker",
			sub: connected ? "Connected" : "Offline",
			tone: connected ? "green" : "amber",
			pulse: connected,
		},
		{
			key: "pg",
			title: "PostgreSQL",
			sub: counts ? `${counts.raw_events.toLocaleString()} events stored` : "—",
			tone: error ? "red" : "green",
		},
		{
			key: "vec",
			title: "pgvector",
			sub: counts ? (awaiting ? `${awaiting} awaiting index` : `${counts.indexed_versions.toLocaleString()} indexed`) : "—",
			tone: awaiting ? "blue" : "green",
			pulse: awaiting > 0,
		},
	];
	return (
		<ol className="ap-map">
			{nodes.map((node, index) => (
				<li
					className="ap-map-node"
					key={node.key}
				>
					<div className="ap-map-card">
						<span className="ap-map-title">
							{node.tone !== "neutral" && (
								<StatusDot
									pulse={node.pulse}
									tone={node.tone}
								/>
							)}
							{node.title}
						</span>
						<span className="ap-map-sub">{node.sub}</span>
					</div>
					{index < nodes.length - 1 && (
						<span
							aria-hidden
							className={`ap-map-link ${stream?.running && index < 2 ? "is-flowing" : ""}`}
						/>
					)}
				</li>
			))}
		</ol>
	);
}

export default function Overview() {
	const { status, stream, events, counts, loading, error, refresh, lastOkAt } = usePipeline();
	const navigate = useNavigate();
	const now = useNow(1000);
	const incidents = useMemo(() => groupIncidents(events), [events]);
	const ready = Boolean(status && counts);
	const failures = status?.ingestion_failures ?? 0;
	const connected = status?.kafka_consumer_status === "connected";

	return (
		<div className="ap-page">
			<PageHeader
				actions={
					<>
						<span className="ap-live">
							<StatusDot
								pulse={!error}
								tone={error ? "amber" : "green"}
							/>
							{error ? "Connection lost" : lastOkAt ? `Live · updated ${timeAgo(lastOkAt, now)}` : "Connecting…"}
						</span>
						<Button
							icon="refresh"
							onClick={refresh}
							size="sm"
						>
							Refresh
						</Button>
					</>
				}
				description="Pipeline health and the incidents moving through it."
				title="Overview"
			/>

			<ErrorBanner
				message={error}
				onRetry={refresh}
			/>

			{!ready && loading && <Skeleton rows={4} />}

			{ready && (
				<>
					<section
						aria-label="Key metrics"
						className="ap-metrics"
					>
						<Metric
							label="Ingestion worker"
							sub="Kafka consumer"
							tone={connected ? "green" : "amber"}
						>
							<StatusDot
								pulse={connected}
								tone={connected ? "green" : "amber"}
							/>
							{connected ? "Connected" : "Offline"}
						</Metric>
						<Metric
							label="Events processed"
							sub="by the worker"
							value={status.events_processed.toLocaleString()}
						/>
						<Metric
							label="Knowledge versions"
							sub={counts.awaiting_index ? `${counts.awaiting_index} awaiting embedding` : "all indexed"}
							value={counts.versions.toLocaleString()}
						/>
						<Metric
							label="Ingestion failures"
							sub={failures ? "see worker logs" : "none recorded"}
							tone={failures ? "red" : undefined}
							value={failures.toLocaleString()}
						/>
						<Metric
							label="Avg query latency"
							sub={status.avg_query_latency_ms == null ? "no queries yet" : "since API start"}
							value={status.avg_query_latency_ms == null ? "—" : formatDuration(status.avg_query_latency_ms)}
						/>
					</section>

					<section className="ap-section">
						<div className="ap-section-head">
							<h2>Pipeline</h2>
							<Link
								className="ap-link"
								to="/app/stream"
							>
								Open event stream
								<Icon
									name="arrow"
									size={14}
								/>
							</Link>
						</div>
						<PipelineMap
							counts={counts}
							error={error}
							status={status}
							stream={stream}
						/>
					</section>

					<section className="ap-section">
						<div className="ap-section-head">
							<h2>Recently active incidents</h2>
							<span className="ap-muted">Latest state per incident</span>
						</div>
						{incidents.length === 0 ? (
							<EmptyState
								action={
									<Button
										onClick={() => navigate("/app/simulator")}
										variant="primary"
									>
										Open simulator
									</Button>
								}
								icon="stream"
								title="No incidents ingested yet"
							>
								Publish events from the simulator and they will appear here once the worker has persisted them.
							</EmptyState>
						) : (
							<div className="ap-table-wrap">
								<table className="ap-table is-clickable">
									<thead>
										<tr>
											<th>Incident</th>
											<th>Current status</th>
											<th className="ap-hide-sm">Service</th>
											<th className="ap-hide-md">Latest update</th>
											<th className="ap-num">Updates</th>
											<th className="ap-num">Ingested</th>
										</tr>
									</thead>
									<tbody>
										{incidents.slice(0, 8).map((incident) => {
											const payload = incident.current.payload || {};
											return (
												<tr
													key={incident.entity_id}
													onClick={() => navigate(`/app/intelligence?entity=${incident.entity_id}`)}
												>
													<td className="ap-strong">{incident.entity_id}</td>
													<td>
														<Badge tone={statusTone(payload.status)}>{humanize(payload.status)}</Badge>
													</td>
													<td className="ap-hide-sm">
														{payload.service || <span className="ap-muted">—</span>}
														{payload.severity && <span className="ap-muted"> · {payload.severity}</span>}
													</td>
													<td className="ap-hide-md ap-clip">{payload.description || <span className="ap-muted">—</span>}</td>
													<td className="ap-num">{incident.updates}</td>
													<td className="ap-num ap-muted">{timeAgo(incident.lastIngested, now)}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
					</section>
				</>
			)}
		</div>
	);
}
