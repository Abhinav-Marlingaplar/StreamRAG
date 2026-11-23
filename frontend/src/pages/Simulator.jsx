import { useState } from "react";
import { publishCustomEvent, publishDemoEvents } from "../lib/api";

const presets = [
	{ value: "incident_created", label: "incident_created" },
	{ value: "incident_updated", label: "incident_updated" },
	{ value: "incident_resolved", label: "incident_resolved" },
];

export default function Simulator() {
	const [form, setForm] = useState({
		entity_id: "INC-2042",
		event_type: "incident_created",
		status: "investigating",
		root_cause: "",
		mitigation: "",
		description: "Placeholder incident description",
		event_time: "",
		source: "simulator",
	});
	const [loadingDemo, setLoadingDemo] = useState(false);
	const [loadingCustom, setLoadingCustom] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const runDemoScenario = async () => {
		setLoadingDemo(true);
		setError("");
		setSuccess("");
		try {
			const response = await publishDemoEvents(true);
			setSuccess(`Published demo scenario: ${response.published_count} events.`);
		} catch (err) {
			setError(err.response?.data?.detail || "Failed to publish demo scenario.");
		} finally {
			setLoadingDemo(false);
		}
	};

	const publishCustom = async (event) => {
		event.preventDefault();
		setLoadingCustom(true);
		setError("");
		setSuccess("");
		try {
			const payload = {
				entity_id: form.entity_id.trim().toUpperCase(),
				event_type: form.event_type,
				event_time: form.event_time || null,
				source: form.source || "simulator",
				payload: {
					status: form.status,
					root_cause: form.root_cause || undefined,
					mitigation: form.mitigation || undefined,
					description: form.description || undefined,
				},
			};
			await publishCustomEvent(payload);
			setSuccess("Custom event published to Kafka.");
		} catch (err) {
			setError(err.response?.data?.detail || "Failed to publish custom event.");
		} finally {
			setLoadingCustom(false);
		}
	};

	return (
		<div className="page-stack">
			<section className="page-header">
				<h1>Event Simulator</h1>
				<p className="muted">Publish deterministic demo scenarios or custom events, including out-of-order timestamps.</p>
			</section>

			<section className="panel row-between">
				<div>
					<h2>Demo scenario</h2>
					<p className="muted">Publishes the repository scenario sequence through the same Kafka ingestion path.</p>
				</div>
				<button
					className="btn btn-primary"
					disabled={loadingDemo}
					onClick={runDemoScenario}
					type="button"
				>
					{loadingDemo ? "Publishing..." : "Run demo sequence"}
				</button>
			</section>

			<section className="panel">
				<h2>Custom event</h2>
				<form
					className="form-grid"
					onSubmit={publishCustom}
				>
					<label className="field">
						<span className="field-label">Entity ID</span>
						<input
							className="input"
							onChange={(e) => setForm((prev) => ({ ...prev, entity_id: e.target.value }))}
							required
							type="text"
							value={form.entity_id}
						/>
					</label>
					<label className="field">
						<span className="field-label">Event Type</span>
						<select
							className="input"
							onChange={(e) => setForm((prev) => ({ ...prev, event_type: e.target.value }))}
							value={form.event_type}
						>
							{presets.map((item) => (
								<option
									key={item.value}
									value={item.value}
								>
									{item.label}
								</option>
							))}
						</select>
					</label>
					<label className="field">
						<span className="field-label">Status</span>
						<input
							className="input"
							onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
							required
							type="text"
							value={form.status}
						/>
					</label>
					<label className="field">
						<span className="field-label">Event Time (optional)</span>
						<input
							className="input"
							onChange={(e) => setForm((prev) => ({ ...prev, event_time: e.target.value }))}
							placeholder="2026-09-26T10:30:00Z"
							type="text"
							value={form.event_time}
						/>
					</label>
					<label className="field full">
						<span className="field-label">Description</span>
						<textarea
							className="input textarea"
							onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
							rows={3}
							value={form.description}
						/>
					</label>
					<label className="field">
						<span className="field-label">Root Cause</span>
						<input
							className="input"
							onChange={(e) => setForm((prev) => ({ ...prev, root_cause: e.target.value }))}
							type="text"
							value={form.root_cause}
						/>
					</label>
					<label className="field">
						<span className="field-label">Mitigation</span>
						<input
							className="input"
							onChange={(e) => setForm((prev) => ({ ...prev, mitigation: e.target.value }))}
							type="text"
							value={form.mitigation}
						/>
					</label>
					<label className="field">
						<span className="field-label">Source</span>
						<input
							className="input"
							onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
							type="text"
							value={form.source}
						/>
					</label>
					<div className="field full">
						<button
							className="btn btn-primary"
							disabled={loadingCustom}
							type="submit"
						>
							{loadingCustom ? "Publishing..." : "Publish custom event"}
						</button>
					</div>
				</form>
				{error && <p className="error-text">{error}</p>}
				{success && <p className="success-text">{success}</p>}
			</section>
		</div>
	);
}
