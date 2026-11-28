import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import EventDrawer from "../app/EventDrawer";
import { usePipeline } from "../app/PipelineContext";
import { Icon } from "../app/icons";
import { Badge, Button, EmptyState, ErrorBanner, PageHeader, Skeleton, StageTrack, StatusDot, stageSummary } from "../app/ui";
import {
	EVENT_TYPE_LABEL,
	formatClock,
	formatDuration,
	humanize,
	pipelineLatency,
	statusTone,
} from "../lib/format";

const TYPE_FILTERS = [
	["all", "All"],
	["incident_created", "Created"],
	["incident_updated", "Updated"],
	["incident_resolved", "Resolved"],
];

const STAGE_FILTERS = [
	["all", "Any stage"],
	["inflight", "In flight"],
	["indexed", "Indexed"],
];

const NEW_ROW_MS = 2600;

const enteredAt = (event) => event.published_at || event.ingested_at;
const isInFlight = (event) => event.stage !== "indexed" && !event.duplicate;

export default function EventStream() {
	const { events, counts, status, stream, loading, error, refresh } = usePipeline();
	const navigate = useNavigate();
	const [paused, setPaused] = useState(false);
	const [frozen, setFrozen] = useState([]);
	const [query, setQuery] = useState("");
	const [type, setType] = useState("all");
	const [stage, setStage] = useState("all");
	const [selectedId, setSelectedId] = useState(null);
	const [newIds, setNewIds] = useState(() => new Set());
	const seen = useRef(null);

	const source = paused ? frozen : events;

	useEffect(() => {
		if (loading && events.length === 0) return;
		if (seen.current === null) {
			seen.current = new Set(events.map((event) => event.event_id));
			return;
		}
		const fresh = events.filter((event) => !seen.current.has(event.event_id)).map((event) => event.event_id);
		if (!fresh.length) return;
		fresh.forEach((id) => seen.current.add(id));
		setNewIds((prev) => new Set([...prev, ...fresh]));
		setTimeout(() => {
			setNewIds((prev) => {
				const next = new Set(prev);
				fresh.forEach((id) => next.delete(id));
				return next;
			});
		}, NEW_ROW_MS);
	}, [events, loading]);

	const togglePause = () => {
		if (!paused) setFrozen(events);
		setPaused((value) => !value);
	};

	const hiddenNew = paused ? events.filter((event) => !frozen.some((old) => old.event_id === event.event_id)).length : 0;

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return source.filter((event) => {
			if (type !== "all" && event.event_type !== type) return false;
			if (stage === "inflight" && !isInFlight(event)) return false;
			if (stage === "indexed" && event.stage !== "indexed") return false;
			if (!needle) return true;
			const payload = event.payload || {};
			return [event.entity_id, event.event_id, event.source, payload.description, payload.service, payload.status]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(needle));
		});
	}, [source, query, type, stage]);

	const selected = useMemo(
		() => events.find((event) => event.event_id === selectedId) || frozen.find((event) => event.event_id === selectedId) || null,
		[events, frozen, selectedId]
	);
	const closeDrawer = useCallback(() => setSelectedId(null), []);

	const inFlight = events.filter(isInFlight).length;
	const failures = status?.ingestion_failures ?? 0;
	const filtersActive = query || type !== "all" || stage !== "all";
	const clearFilters = () => {
		setQuery("");
		setType("all");
		setStage("all");
	};

	return (
		<div className="ap-page">
			<PageHeader
				actions={
					<>
						<Button
							icon={paused ? "play" : "pause"}
							onClick={togglePause}
							size="sm"
						>
							{paused ? "Resume" : "Pause"}
						</Button>
					</>
				}
				description="Operational events from Kafka through the worker into PostgreSQL and the vector index."
				title="Event Stream"
			/>

			<ErrorBanner
				message={error}
				onRetry={refresh}
			/>

			<section
				aria-label="Pipeline counters"
				className="ap-ribbon"
			>
				<div className="ap-ribbon-item">
					<StatusDot
						pulse={stream?.running}
						tone={stream?.running ? "amber" : "neutral"}
					/>
					<span className="ap-ribbon-label">Simulator</span>
					<strong>{stream?.running ? `Streaming · ${stream.published_count} sent` : "Idle"}</strong>
				</div>
				<div className="ap-ribbon-item">
					<span className="ap-ribbon-label">In flight</span>
					<strong className={inFlight ? "is-blue" : ""}>{inFlight}</strong>
				</div>
				<div className="ap-ribbon-item">
					<span className="ap-ribbon-label">Persisted</span>
					<strong>{counts ? counts.raw_events.toLocaleString() : "—"}</strong>
				</div>
				<div className="ap-ribbon-item">
					<span className="ap-ribbon-label">Indexed</span>
					<strong>{counts ? counts.indexed_versions.toLocaleString() : "—"}</strong>
				</div>
				<div className="ap-ribbon-item">
					<span className="ap-ribbon-label">Failures</span>
					<strong className={failures ? "is-red" : ""}>{failures}</strong>
				</div>
			</section>

			<div className="ap-toolbar">
				<label className="ap-search">
					<Icon
						name="search"
						size={15}
					/>
					<input
						aria-label="Search events"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search incident, event ID, service, description…"
						type="search"
						value={query}
					/>
				</label>
				<div
					aria-label="Event type"
					className="ap-segment"
					role="group"
				>
					{TYPE_FILTERS.map(([id, label]) => (
						<button
							aria-pressed={type === id}
							className={type === id ? "is-active" : ""}
							key={id}
							onClick={() => setType(id)}
							type="button"
						>
							{label}
						</button>
					))}
				</div>
				<div
					aria-label="Processing stage"
					className="ap-segment"
					role="group"
				>
					{STAGE_FILTERS.map(([id, label]) => (
						<button
							aria-pressed={stage === id}
							className={stage === id ? "is-active" : ""}
							key={id}
							onClick={() => setStage(id)}
							type="button"
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{paused && (
				<div className="ap-paused">
					<span>
						<Icon
							name="pause"
							size={14}
						/>
						Live updates paused{hiddenNew ? ` · ${hiddenNew} new event${hiddenNew === 1 ? "" : "s"} waiting` : ""}
					</span>
					<Button
						onClick={togglePause}
						size="sm"
						variant="primary"
					>
						Resume
					</Button>
				</div>
			)}

			{loading && events.length === 0 ? (
				<Skeleton rows={8} />
			) : source.length === 0 ? (
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
					title="No events in the pipeline yet"
				>
					Start the simulator and events will appear here the moment they are published to Kafka.
				</EmptyState>
			) : filtered.length === 0 ? (
				<EmptyState
					action={<Button onClick={clearFilters}>Clear filters</Button>}
					icon="search"
					title="No events match these filters"
				/>
			) : (
				<div
					className="ap-feed"
					role="table"
				>
					<div
						className="ap-feed-head"
						role="row"
					>
						<span role="columnheader">Time</span>
						<span role="columnheader">Incident</span>
						<span role="columnheader">Event</span>
						<span role="columnheader">Details</span>
						<span role="columnheader">Pipeline</span>
						<span
							className="ap-num"
							role="columnheader"
						>
							Latency
						</span>
					</div>
					{filtered.map((event) => {
						const payload = event.payload || {};
						const summary = stageSummary(event);
						const latency = pipelineLatency(event);
						return (
							<div
								aria-label={`${event.entity_id} ${event.event_type}`}
								className={`ap-feed-row ${newIds.has(event.event_id) ? "is-new" : ""} ${selectedId === event.event_id ? "is-selected" : ""}`}
								key={event.event_id}
								onClick={() => setSelectedId(event.event_id)}
								onKeyDown={(keyEvent) => {
									if (keyEvent.key === "Enter" || keyEvent.key === " ") {
										keyEvent.preventDefault();
										setSelectedId(event.event_id);
									}
								}}
								role="row"
								tabIndex={0}
							>
								<span
									className="ap-feed-time"
									role="cell"
									title={enteredAt(event)}
								>
									{formatClock(enteredAt(event))}
									{new Date(enteredAt(event)).toDateString() !== new Date().toDateString() && (
										<small>{new Date(enteredAt(event)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
									)}
								</span>
								<span
									className="ap-feed-incident"
									role="cell"
								>
									{event.entity_id}
								</span>
								<span
									className="ap-feed-type"
									role="cell"
								>
									<Badge tone="neutral">{EVENT_TYPE_LABEL[event.event_type] || humanize(event.event_type)}</Badge>
								</span>
								<span
									className="ap-feed-details"
									role="cell"
								>
									<span className="ap-feed-line">
										{payload.status && <Badge tone={statusTone(payload.status)}>{humanize(payload.status)}</Badge>}
										{payload.service && <span className="ap-feed-service">{payload.service}</span>}
										{payload.severity && <span className="ap-muted">{payload.severity}</span>}
									</span>
									<span className="ap-feed-desc">{payload.description || <em>No description</em>}</span>
									<span className="ap-feed-meta">
										{event.source} · {event.event_id}
									</span>
								</span>
								<span
									className="ap-feed-stage"
									role="cell"
								>
									<StageTrack event={event} />
									<span className={`ap-feed-state is-${summary.tone}`}>{summary.label}</span>
								</span>
								<span
									className="ap-num ap-feed-latency"
									role="cell"
								>
									{latency != null ? formatDuration(latency) : "—"}
								</span>
							</div>
						);
					})}
					<p className="ap-feed-foot">
						Showing {filtered.length} of {source.length} most recent events · timestamps in local time ·{" "}
						<Link
							className="ap-link"
							to="/app/simulator"
						>
							publish more
						</Link>
					</p>
				</div>
			)}

			<EventDrawer
				event={selected}
				onClose={closeDrawer}
			/>
		</div>
	);
}
