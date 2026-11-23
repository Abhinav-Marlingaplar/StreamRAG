import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchTimeline } from "../lib/api";

export default function Timeline() {
	const { entityId = "INC-1024" } = useParams();
	const navigate = useNavigate();
	const [records, setRecords] = useState([]);
	const [queryEntity, setQueryEntity] = useState(entityId);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const loadTimeline = async (nextEntity = entityId) => {
		setLoading(true);
		setError("");
		try {
			const data = await fetchTimeline(nextEntity);
			setRecords(data);
		} catch (err) {
			setError(err.response?.data?.detail || "Unable to load timeline.");
			setRecords([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		setQueryEntity(entityId);
		loadTimeline(entityId);
	}, [entityId]);

	return (
		<div className="page-stack">
			<section className="page-header">
				<h1>Incident Timeline</h1>
				<p className="muted">Inspect version history, validity windows, and current vs superseded temporal states.</p>
			</section>

			<section className="panel">
				<div className="row">
					<input
						className="input"
						onChange={(e) => setQueryEntity(e.target.value)}
						placeholder="INC-1024"
						type="text"
						value={queryEntity}
					/>
					<button
						className="btn btn-primary"
						onClick={() => {
							const value = queryEntity.trim() || "INC-1024";
							navigate(`/app/timeline/${value.toUpperCase()}`);
						}}
						type="button"
					>
						Load timeline
					</button>
				</div>
			</section>

			<section className="panel stack">
				{loading && <p className="muted">Loading timeline...</p>}
				{error && <p className="error-text">{error}</p>}
				{!loading && !error && records.length === 0 && (
					<p className="muted">No timeline rows available for this entity.</p>
				)}
				{records.map((row) => (
					<article
						className={`timeline-entry ${row.is_current ? "timeline-current" : ""}`}
						key={row.id}
					>
						<div className="timeline-marker" />
						<div className="timeline-body">
							<div className="row-between">
								<p>
									<strong>{row.status}</strong> · v{row.version}
								</p>
								<p className="caption">{row.is_current ? "current" : "superseded"}</p>
							</div>
							<p>{row.content}</p>
							<p className="caption">
								{row.valid_from} → {row.valid_to || "current"}
							</p>
						</div>
					</article>
				))}
			</section>
		</div>
	);
}
