import { useEffect, useMemo, useState } from "react";
import { fetchRecentEvents } from "../lib/api";

function matchesTimestamp(item, from, to) {
	if (!from && !to) {
		return true;
	}
	const eventTime = new Date(item.timestamp).getTime();
	if (Number.isNaN(eventTime)) {
		return false;
	}
	if (from) {
		const fromTime = new Date(from).getTime();
		if (!Number.isNaN(fromTime) && eventTime < fromTime) {
			return false;
		}
	}
	if (to) {
		const toTime = new Date(to).getTime();
		if (!Number.isNaN(toTime) && eventTime > toTime) {
			return false;
		}
	}
	return true;
}

export default function Events() {
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [entityFilter, setEntityFilter] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [fromTime, setFromTime] = useState("");
	const [toTime, setToTime] = useState("");

	const loadEvents = async () => {
		setLoading(true);
		setError("");
		try {
			const data = await fetchRecentEvents(80);
			setEvents(data);
		} catch (err) {
			setError(err.response?.data?.detail || "Unable to load event stream.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadEvents();
		const id = setInterval(loadEvents, 7000);
		return () => clearInterval(id);
	}, []);

	const filteredEvents = useMemo(() => {
		return events.filter((item) => {
			const entityMatch = entityFilter ? item.entity_id?.toLowerCase().includes(entityFilter.toLowerCase()) : true;
			const typeValue = item.event_type || item.status || "unknown";
			const typeMatch = typeFilter === "all" ? true : typeValue === typeFilter;
			const timeMatch = matchesTimestamp(item, fromTime, toTime);
			return entityMatch && typeMatch && timeMatch;
		});
	}, [entityFilter, events, fromTime, toTime, typeFilter]);

	return (
		<div className="page-stack">
			<section className="page-header row-between">
				<div>
					<h1>Event Stream</h1>
					<p className="muted">Filter live event and knowledge-version updates by entity, type, and timestamp windows.</p>
				</div>
				<button
					className="btn btn-ghost"
					onClick={loadEvents}
					type="button"
				>
					Refresh
				</button>
			</section>

			<section className="panel">
				<div className="filters-grid">
					<input
						className="input"
						onChange={(e) => setEntityFilter(e.target.value)}
						placeholder="Entity filter (e.g. INC-1024)"
						type="text"
						value={entityFilter}
					/>
					<select
						className="input"
						onChange={(e) => setTypeFilter(e.target.value)}
						value={typeFilter}
					>
						<option value="all">All types</option>
						<option value="incident_created">incident_created</option>
						<option value="incident_updated">incident_updated</option>
						<option value="incident_resolved">incident_resolved</option>
						<option value="investigating">investigating</option>
						<option value="root_cause_identified">root_cause_identified</option>
						<option value="mitigated">mitigated</option>
						<option value="resolved">resolved</option>
					</select>
					<input
						className="input"
						onChange={(e) => setFromTime(e.target.value)}
						type="datetime-local"
						value={fromTime}
					/>
					<input
						className="input"
						onChange={(e) => setToTime(e.target.value)}
						type="datetime-local"
						value={toTime}
					/>
				</div>
			</section>

			<section className="panel stack">
				{loading && <p className="muted">Loading recent events...</p>}
				{error && <p className="error-text">{error}</p>}
				{!loading && !error && filteredEvents.length === 0 && (
					<p className="muted">No events matched these filters.</p>
				)}
				{!loading &&
					!error &&
					filteredEvents.map((item, index) => (
						<article
							className="event-row"
							key={`${item.kind}-${item.event_id || item.knowledge_version_id || index}`}
						>
							<div>
								<p>
									<strong>{item.entity_id}</strong> · {item.kind}
								</p>
								<p className="caption">{item.event_type || item.status || "unknown"}</p>
							</div>
							<p className="caption">{item.timestamp}</p>
						</article>
					))}
			</section>
		</div>
	);
}
